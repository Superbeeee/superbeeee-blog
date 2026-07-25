---
title: "ブラウザに挨拶する：Google のオンデバイス・ニューラルネット MediaPipe で遊ぶ"
date: 2026-07-24 10:00:00
lang: ja
translation_key: mediapipe-browser-presence-detection
description: フロントエンドエンジニアが MediaPipe Tasks を使い、純粋なブラウザ環境だけで「人が近づいたら挨拶し、手を振ったら振り返す」インタラクティブ demo を作った完全ノート。技術選定、WASM runtime とモデルファイルのメンタルモデル、GPU fallback の初期化パターン、検出ループのスロットリングから、いちばん重要な「知覚／判定の分離」アーキテクチャ——フレームごとの検出結果を信頼できる行動イベントに変える話——まで。ハマりどころの一覧表つき。
categories:
  - 技術
tags:
  - MediaPipe
  - AI
  - Computer Vision
  - 前端
  - TypeScript
---

最近こんなことに着手した：**ブラウザだけで「目を持つ」小さなおもちゃを作れないか？** カメラが誰かの接近を捉えたら挨拶し、手を振れば振り返す。アプリのインストールも、バックエンドの構築も、映像をどこかのサーバーへ送ることもなし——ウェブページを開いた瞬間に動く。

少し調べてみた結論は「作れる」、しかも想像よりずっと簡単だった。主役は Google の **MediaPipe Tasks**。モデルはブラウザ内で WebAssembly + GPU で直接動き、**映像は最初から最後までデバイスの外に出ない**ので、プライバシー面でかなり安心できる。これはゼロから demo が動くところまで手探りした自分の完全ノートで、自分と同じく「フロントには慣れているが AI ビジョンは未経験」という人に向けて書いている。

<!-- more -->

## 0. まず結論：ハードルは思ったより低い

一文だけ残すならこれ：

> ブラウザで顔／ジェスチャー検出をやるとき、難しいのは「AI を呼ぶこと」ではない——それは数行の初期化とループだけ。難しいのは**フレームごとの検出結果を、信頼できる行動イベントに変えること**だ。

前半は公式ドキュメントで学べる。後半（誤検出防止、連発防止、ステートマシン設計）こそがこの記事の本題で、第 6 節に置いた。

## 1. 技術選定：なぜ MediaPipe Tasks か？

「ブラウザ内でのビジョン検出」には、いま表舞台に 3 つの道がある：

| 選択肢 | 評価 |
|------|------|
| **MediaPipe Tasks** | WASM + GPU delegate でパフォーマンス最良。顔とジェスチャーが同じエコシステムで runtime を共有。全工程オンデバイス推論 |
| TensorFlow.js | 可能だが runtime が重めで、コールドスタートが明らかに一段遅い |
| ネイティブ `FaceDetector` API | ブラウザ対応が薄く、実験用おもちゃ止まり |

もう一つの重要な判断が「**どうやって人の接近を判定するか**」。MacBook のカメラはただの一般的なカメラで、専用の深度カメラほどではないので、泥臭いが効果的な代理指標を使った：**顔幅比**——顔の bounding box の幅をフレーム幅で割ったもの。近づくほど顔は大きくなる、それだけ。代償として閾値がカメラの画角と設置位置に紐づくため、置き場所を変えれば再キャリブレーションが要る。とはいえ demo には十分すぎる。

![MediaPipe 顔検出デモ：カメラが顔を検出し bounding box を描く。近づくほど box が大きくなる](/images/mediapipe-browser-presence-detection/01-face-detection.gif)

## 2. メンタルモデル：動かすには 3 つのモノが要る

これは先にはっきりさせておく価値が最も高い概念だと思う。MediaPipe をブラウザで動かすには、それぞれ役割の違う 3 つのリソースが要る：

1. **WASM runtime（エンジン）**——C++ の推論エンジンを WebAssembly にコンパイルしたもので、約 33MB。中に SIMD / nosimd の 2 種のバリアントを含み、ロード時にブラウザの対応に応じて自動で選ぶ（現代の Chrome はどれも SIMD 対応なので、本番デプロイでは SIMD 版だけ残して 11MB ほどに絞れる）
2. **モデルファイル（燃料）**——学習済みの重み：
   - `blaze_face_short_range.tflite`（**229KB**、信じられないほど小さい）：顔検出。short-range 版は 2 メートル以内の近距離シナリオ向けに設計されている
   - `gesture_recognizer.task`（8MB）：実は 3 つのモデルのパッケージ——手のひら検出 + 21 個のランドマーク + 静的ジェスチャー分類
3. **JS グルー層**——`@mediapipe/tasks-vision` という npm パッケージ本体で、ロードとデータの受け渡しを担う

エンジン、燃料、グルー、どれも欠けてはいけない。この役割分担を掴めば、以降のロード設定はすべて理解しやすくなる。

## 3. リソースは全部セルフホスト、CDN は使わない

公式サンプルはどれも wasm とモデルを CDN からロードするが、ここでは全部ダウンロードして `public/` に置くことにした：

```bash
npm install @mediapipe/tasks-vision
cp node_modules/@mediapipe/tasks-vision/wasm/* public/mediapipe/wasm/
curl -o public/mediapipe/blaze_face_short_range.tflite \
  https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite
```

理由はシンプル：もしプロジェクトが**ネットワークの不安定な環境**で動くなら、当然オフラインでも安定して動いてほしい。セルフホストにすれば、検出機能まるごとが外部サービスに**ゼロ依存**になる。

## 4. 初期化：二段構え + GPU fallback

MediaPipe のタスクはどれも同じ型で初期化する。一度覚えれば済む：

```ts
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision'

// 第一段：wasm runtime をロード（ここで SIMD 対応を自動検出）
const fileset = await FilesetResolver.forVisionTasks('/mediapipe/wasm')

// 第二段：モデルをロードしてインスタンス生成——GPU 優先、失敗したら CPU
for (const delegate of ['GPU', 'CPU'] as const) {
  try {
    detector = await FaceDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: '/mediapipe/blaze_face_short_range.tflite', delegate },
      runningMode: 'VIDEO',
      minDetectionConfidence: 0.5,
    })
    break
  } catch (e) { console.warn(`${delegate} delegate の初期化に失敗`, e) }
}
```

いくつかの要点：

- **delegate = 推論がどこで走るか**。`GPU`（WebGL 経由）は CPU の数倍速いが、ユーザーのマシンに使える GPU があるかは決してわからない——だから **GPU→CPU の fallback は必ず書く**、さもないと低スペック機で起動すらしない
- **`runningMode: 'VIDEO'`**：連続フレームモードで、モデルは前フレームの結果を使ってトラッキングを速める。対応する推論メソッドは `detectForVideo()`、IMAGE モードなら `detect()`。**モードとメソッドは必ずペアで、間違えると即例外**
- ジェスチャーの `GestureRecognizer` の初期化はまったく同じ型、`numHands: 1` が一つ増えるだけ

もう一つの習慣：`await import('@mediapipe/tasks-vision')` で**遅延ロード**し、ジェスチャーモデルは手振り機能が実際にオンになってから初めてロードする。機能オフならロードコストは一切払わない。

## 5. フレームの供給と検出ループ

### 供給：video 要素をまるごと渡す

```ts
stream = await navigator.mediaDevices.getUserMedia({
  video: { width: { ideal: 640 }, height: { ideal: 480 } },
})
video.srcObject = stream
await video.play()

const result = detector.detectForVideo(video, performance.now())
```

- `<video>` 要素を**そのまま渡す**——MediaPipe が現在フレームを自分で取得し、しかも GPU テクスチャ経路を通るので、手動で canvas からピクセルを取るより速い。video 要素は DOM に入れる必要すらなく、`document.createElement('video')` で純粋なフレーム容器として使えば十分
- 解像度をあえて 640×480 に落とす：検出には十分すぎ、推論の入力は小さいほど速い
- `detectForVideo()` は**同期呼び出し**で、メインスレッドを数 ms〜十数 ms 占有する——これが次節でスロットリングする理由そのもの

### ループ：rAF + 二重ゲートのスロットリング

```ts
const loop = () => {
  rafId = requestAnimationFrame(loop)                  // ~60Hz でついて回る
  const now = performance.now()
  if (now - lastDetectTs < 1000 / TARGET_FPS) return   // ゲート1：8fps にスロットル
  if (video.currentTime === lastVideoTime) return      // ゲート2：同一フレームは再計算しない
  lastDetectTs = now
  lastVideoTime = video.currentTime
  const result = detector.detectForVideo(video, now)
  // ...結果を消化
}
```

核心の考え方は**検出頻度と画面更新のデカップリング**：rAF は普通に 60Hz で回るが、実際の推論はゲートで 8fps まで抑える。「人が近づく」という時間スケールなら 8fps で十分すぎる（試しに 60fps に設定してみても意外と滑らかだった）。ページ上に他に GPU を食うもの（たとえば 3D シーン）があるなら、このデカップリングこそがリソースを奪い合わない鍵になる。

手振りは例外——各スイングは 300〜500ms しかなく、より密なサンプリングが要るので、手振り機能をオンにしたときはループ全体を 12fps に引き上げる。複数モデルの同時実行はリソース消費を倍にする。これがジェスチャーモデルを「必要になってからロード、トグルで時分割」すべき理由だ。

もう一つ注意点：**VIDEO モードの timestamp は単調増加でなければならない**、逆行すると即例外。私の解法は、スロットル判定と推論の引数で同じ `performance.now()` の値を共有し、不整合を源から断つこと。

## 6. 知覚／判定の分離：「フレームごとの事実」を「行動イベント」に変える

ここまでで、フレームごとに検出結果を取れるようになった。だがすぐに一つの問題にぶつかる：

> MediaPipe が教えてくれるのは**状態を持たないフレームごとの事実**——「このフレームに顔が一つ、この大きさ」「このフレームで手のひらが開いている、手首はここ」。それは「**人が近づいてきた**」とか「**こちらに手を振っている**」とは教えてくれない。

単一フレームの結果でそのまま行動を発火させると、それは惨事だ：通りすがりがふらっと横切れば挨拶し、フレームを一つ落とせば人が去ったと勘違いし、ジェスチャーモデルが認識するのは**静的**なジェスチャーなのに手振りは**動的**な動作……

私の解法は、判定を **MediaPipe に一切触れない 2 つの純粋ロジックモジュール**へ収束させること。手法はどちらも**時間フィルタリング**：

**`usePresenceStateMachine`——入場判定ステートマシン：**

```
idle → approaching（顔幅比が閾値に達する）
     → greeted（N ミリ秒連続で維持して初めて挨拶を発火）
     → cooldown（顔が M ミリ秒消えて初めて本当に去ったと判定）
     → idle
```

3 段のヒステリシスがそれぞれ一種類の誤検出を防ぐ：入場は「連続確認」で通りすがりの誤爆を防ぎ、退場は「消失確認」でフレーム落ちの誤爆を防ぎ、cooldown は同じ人への挨拶の連発を防ぐ。

**`useWaveDetector`——手振り検出：**

手首の x 座標の**折り返し点**（山谷検出）を追う：時間ウィンドウ内で方向反転が N 回に達し、かつ振幅が基準を超えて初めて一回の手振りと数える。フレーム落ちには 400ms の猶予。おまけの利点——このロジックは「方向が反転したか」だけを見て絶対的な向きは見ないので、プレビューがミラーリングされていても全く影響を受けない。

![MediaPipe ジェスチャー検出デモ：手振りを認識し、21 点の手の骨格を描く](/images/mediapipe-browser-presence-detection/02-gesture-detection.gif)

この 2 つのモジュールは時間をすべて**外部から注入**する（`performance.now()` を引数で渡す）ので、偽データを食わせてユニットテストが書ける。

データフロー全体を一文に収束させると：

> **カメラがフレームを供給 → MediaPipe が事実に変換（このフレームに何があるか）→ ステートマシンがイベントに変換（どんな行動が起きたか）→ アプリ層がアクションに変換（挨拶する）。**

各層は一つ上の層の出力だけに依存し、MediaPipe は最も外側の環に隔離されている——いつか別の検出エンジンに差し替えても、判定層は一行も変わらない。

## 7. 検出結果を消化するためのチートシート

**FaceDetector**（`result.detections[]`、顔ごとに一項目）：

```ts
// 複数人が写り込んだら信頼度が最も高い顔を取る
const best = result.detections.reduce((a, b) =>
  (b.categories[0]?.score ?? 0) > (a?.categories[0]?.score ?? 0) ? b : a,
  result.detections[0])
const faceWidthRatio = best.boundingBox.width / video.videoWidth  // 距離の代理
```

**GestureRecognizer**（`recognizeForVideo()`）：

```ts
const topGesture = result.gestures[0]?.[0]  // { categoryName: 'Open_Palm', score: 0.92 }
const landmarks  = result.landmarks[0]      // 21 個のランドマーク（normalized 0~1）
const wrist      = landmarks?.[0]           // インデックス 0 = 手首
```

- 内蔵の静的ジェスチャー分類：Open_Palm / Closed_Fist / Thumb_Up / Victory / Pointing_Up / ILoveYou
- 21 個のランドマークのインデックスは固定：0 手首、4 親指の先、8 人差し指の先……20 小指の先
- 手の骨格を描きたいなら、接続テーブルがパッケージに内蔵：`GestureRecognizer.HAND_CONNECTIONS`

## 8. ハマりどころ一覧表

| ハマりどころ | 対処 |
|----|----|
| wasm／モデルを CDN からロード、オフライン環境で即死 | 全部 `public/` に入れてセルフホスト |
| マシンに使える GPU がなく、GPU delegate の生成に失敗 | GPU→CPU の fallback ループ。実際にどちらが効いたかは console log を見る |
| timestamp が逆行して例外 | スロットルと推論で同じ `performance.now()` の値を共有 |
| ミラープレビュー（CSS `scaleX(-1)`）で canvas 上の文字が鏡文字になる | 文字を描くときにローカルでもう一度反転して戻す |
| Vite build は型チェックしないので、API 名のスペルミスが捕まらない | `node_modules/@mediapipe/tasks-vision/vision.d.ts` に直接 grep して検証 |
| USB カメラが長時間運転でたまに切断 | track の `ended` イベントを監視し、3 秒後に自動リトライ |
| 複数モデルの同時実行がパフォーマンスを食う | ジェスチャーモデルを遅延ロード + トグルで時分割 |

## おわりに

振り返って、今回いちばんの収穫は 2 つ。一つ目は**オンデバイス AI のフロントエンドにとってのハードルは本当にもう相当低い**ということ：229KB のモデル、数行の初期化、一つのスロットルループ、それでブラウザは目を持ち、しかも映像はデバイスの外に出ない。二つ目は、古き良きエンジニアリングの価値は少しも揺らいでいないということ：**AI が渡してくるのは確率的なフレームごとの出力で、それを信頼できるプロダクトの挙動に変えるのは、依然としてステートマシン・ヒステリシス・時間フィルタリングという古典の手仕事だ。**

このほかにも 21 個のランドマークを手の骨格として可視化するのも試したし、今後は MediaPipe Tasks ファミリーの他のメンバー（pose や segmentation はどちらも面白そう）も試してみたい。

あなたも「目を持つ」ウェブの小さなおもちゃを作りたくなったら、公式ドキュメントはこちら：[MediaPipe Solutions guide](https://ai.google.dev/edge/mediapipe/solutions/guide)。本当に難しくない——週末を一つ充てれば、こちらに手を振り返してくれる。楽しんで 👋

> 上記のパラメータも体感も、すべて自分の環境と状況によるもの、参考まで——あなたのカメラ、あなたのマシン、あなたの設置位置は、どれも自分で一度キャリブレーションする価値がある。
