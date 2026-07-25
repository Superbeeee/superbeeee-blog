---
title: 和瀏覽器打招呼：來玩 Google 的神經網路計算 - MediaPipe
date: 2026-07-24 10:00:00
lang: zh-TW
translation_key: mediapipe-browser-presence-detection
description: 一個前端工程師用 MediaPipe Tasks 在純瀏覽器環境做出「偵測有人靠近就打招呼、揮手就回應」互動 demo 的完整筆記。從選型比較、WASM runtime 與模型檔的心智模型、GPU fallback 初始化套路、偵測迴圈節流，到最重要的「感知／判定分離」架構——怎麼把逐幀的偵測結果變成可靠的行為事件，外加一整桌踩坑對照表。
categories:
  - 技術
tags:
  - MediaPipe
  - AI
  - Computer Vision
  - 前端
  - TypeScript
---

最近著手進行：**能不能只靠瀏覽器，做出一個「有眼睛」的小玩具？** 鏡頭看到有人走近，它就打招呼；對它揮揮手，它會回應你。不裝 app、不架後端、不把影像傳去任何伺服器——一個網頁打開就能跑。

稍微研究之後答案是可以，而且比想像中簡單很多。主角是 Google 的 **MediaPipe Tasks**：模型直接在瀏覽器裡用 WebAssembly + GPU 跑，**影像從頭到尾不出裝置**，隱私上安心不少。這篇是自己從零摸索到 demo 能動的完整筆記，寫給跟我一樣「前端熟、AI 視覺零經驗」的人。

<!-- more -->

## 0. 先講結論：門檻比你想的低

如果只能記一句話，我會記這個：

> 在瀏覽器做人臉／手勢偵測，難的不是「呼叫 AI」——那只是幾行初始化加一個迴圈。難的是**把逐幀的偵測結果，變成可靠的行為事件**。

前半段官方文件就教得會；後半段（防誤判、防連發、狀態機設計）才是這篇的重點，放在第 6 節。

## 1. 選型：為什麼是 MediaPipe Tasks？

「瀏覽器內做視覺偵測」目前檯面上有三條路：

| 方案 | 評價 |
|------|------|
| **MediaPipe Tasks** | WASM + GPU delegate 效能最好；人臉、手勢同一生態系共用 runtime；全程裝置端推論 |
| TensorFlow.js | 可行，但 runtime 較重、冷啟動明顯慢一截 |
| 原生 `FaceDetector` API | 瀏覽器支援度不足，只能當實驗玩具 |

另一個關鍵決定是「**怎麼判斷人靠近**」。因為 MacBook 鏡頭只是一般鏡頭，沒有到專業的深度鏡頭，所以用了一個土炮但很有效的代理指標：**臉寬比**——臉部 bounding box 寬度除以畫面寬度。人越近臉越大，就這樣。代價是閾值跟鏡頭視角、擺放位置綁定，換個位置就要重新校準，但對 demo 來說完全夠用。

![MediaPipe 臉部偵測 demo：鏡頭偵測到人臉、框出 bounding box，臉越近框越大](/images/mediapipe-browser-presence-detection/01-face-detection.gif)

## 2. 心智模型：跑起來需要三件東西

這是我覺得最值得先搞清楚的概念。MediaPipe 在瀏覽器裡跑，需要三件各司其職的資源：

1. **WASM runtime（引擎）**——C++ 推論引擎編譯成 WebAssembly，約 33MB。裡面含 SIMD / nosimd 兩組變體，載入時會依瀏覽器支援自動挑（現代 Chrome 都支援 SIMD，正式部署可以只留 SIMD 版，瘦身到 11MB 左右）
2. **模型檔（燃料）**——訓練好的權重：
   - `blaze_face_short_range.tflite`（**229KB**，小到不可思議）：人臉偵測，short-range 版設計給 2 公尺內的近距離場景
   - `gesture_recognizer.task`（8MB）：其實是三個模型打包——手掌偵測 + 21 個關節點 + 靜態手勢分類
3. **JS 膠水層**——`@mediapipe/tasks-vision` 這個 npm 套件本體，負責載入與資料搬運

引擎、燃料、膠水，三者缺一不可。搞懂這個分工，後面所有的載入設定都會變得很好理解。

## 3. 資源全部自己 host，不走 CDN

官方範例都是從 CDN 載 wasm 和模型，但這邊選擇全部抓下來放 `public/`：

```bash
npm install @mediapipe/tasks-vision
cp node_modules/@mediapipe/tasks-vision/wasm/* public/mediapipe/wasm/
curl -o public/mediapipe/blaze_face_short_range.tflite \
  https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite
```

理由很單純：如果專案是在**網路不穩定的環境**去執行，當然會希望它離線也能穩定運作。自己 host 之後，整個偵測功能對外部服務**零依賴**。

## 4. 初始化：兩段式 + GPU fallback

所有 MediaPipe 任務的初始化都是同一個型，記一次就好：

```ts
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision'

// 第一段：載 wasm runtime（此時自動偵測 SIMD 支援）
const fileset = await FilesetResolver.forVisionTasks('/mediapipe/wasm')

// 第二段：載模型建實例——GPU 優先，失敗退 CPU
for (const delegate of ['GPU', 'CPU'] as const) {
  try {
    detector = await FaceDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: '/mediapipe/blaze_face_short_range.tflite', delegate },
      runningMode: 'VIDEO',
      minDetectionConfidence: 0.5,
    })
    break
  } catch (e) { console.warn(`${delegate} delegate 初始化失敗`, e) }
}
```

幾個重點：

- **delegate = 推論跑在哪**。`GPU`（走 WebGL）比 CPU 快好幾倍，但你永遠不知道使用者的機器有沒有可用 GPU——所以 **GPU→CPU fallback 一定要寫**，不然在低階機器上直接開不起來
- **`runningMode: 'VIDEO'`**：連續影格模式，模型會利用前一幀的結果加速追蹤。對應的推論方法是 `detectForVideo()`；IMAGE 模式則配 `detect()`。**模式跟方法必須配對，配錯直接丟例外**
- 手勢的 `GestureRecognizer` 初始化完全同型，多一個 `numHands: 1` 而已

另外一個習慣：用 `await import('@mediapipe/tasks-vision')` **懶載入**，而且手勢模型等到揮手功能真的開啟才載。功能沒開就不浪費載入成本。

## 5. 餵影像與偵測迴圈

### 餵影像：video 元素整個丟進去

```ts
stream = await navigator.mediaDevices.getUserMedia({
  video: { width: { ideal: 640 }, height: { ideal: 480 } },
})
video.srcObject = stream
await video.play()

const result = detector.detectForVideo(video, performance.now())
```

- `<video>` 元素**直接傳進去**，MediaPipe 自己抓當前幀——而且走 GPU 紋理路徑，比自己手動 canvas 取像素還快。video 元素甚至不用進 DOM，`document.createElement('video')` 純當畫格容器就好
- 解析度刻意壓在 640×480：偵測綽綽有餘，推論輸入越小越快
- `detectForVideo()` 是**同步呼叫**，會佔主執行緒幾 ms 到十幾 ms——這就是下一段要節流的原因

### 迴圈：rAF + 雙閘門節流

```ts
const loop = () => {
  rafId = requestAnimationFrame(loop)                  // ~60Hz 跟著跑
  const now = performance.now()
  if (now - lastDetectTs < 1000 / TARGET_FPS) return   // 閘門1：節流至 8fps
  if (video.currentTime === lastVideoTime) return      // 閘門2：同一幀不重算
  lastDetectTs = now
  lastVideoTime = video.currentTime
  const result = detector.detectForVideo(video, now)
  // ...消化結果
}
```

核心觀念是**偵測頻率與畫面更新解耦**：rAF 照常以 60Hz 跑，但真正的推論被閘門壓到 8fps。「人走近」這件事的時間尺度，8fps 綽綽有餘（其實嘗試設定到 60fps 也還是挺順的）；如果頁面上還有其他吃 GPU 的東西（比如 3D 場景），這個解耦就是不互相搶資源的關鍵。

揮手是例外——每段擺動只有 300～500ms，需要比較密的採樣，所以揮手功能開啟時我會把迴圈提頻到 12fps。多模型同跑會加倍吃資源，這也是手勢模型要「用到才載、開關分時」的原因。

還有一個注意的點：**VIDEO 模式的 timestamp 必須單調遞增**，倒退直接丟例外。我的解法是節流判斷跟推論參數共用同一個 `performance.now()` 值，從源頭杜絕不一致。

## 6. 感知／判定分離：把「逐幀事實」變成「行為事件」

到這裡你已經能拿到每一幀的偵測結果了。但馬上會發現一個問題：

> MediaPipe 告訴你的是**無狀態的逐幀事實**——「這幀有一張臉、多大」「這幀手掌張開、手腕在哪」。它不會告訴你「**有人走過來了**」或「**他在跟你揮手**」。

直接拿單幀結果觸發行為，就是災難現場：路人晃過去它打招呼、偵測掉一幀它以為人離開畫面、手勢模型認的是**靜態**手勢而揮手是**動態**動作……

我的解法是把判定收斂到兩個**完全不碰 MediaPipe 的純邏輯模組**，手法都是**時間濾波**：

**`usePresenceStateMachine`——進場判定狀態機：**

```
idle → approaching（臉寬比達閾值）
     → greeted（連續維持滿 N 毫秒才觸發打招呼）
     → cooldown（臉消失滿 M 毫秒才算真的離開）
     → idle
```

三段遲滯（hysteresis）各擋一種誤判：進場要「連續確認」防路人誤觸、離場要「消失確認」防掉幀誤判、cooldown 防對同一個人連環問候。

**`useWaveDetector`——揮手偵測：**

追蹤手腕 x 座標的**折返點**（峰谷偵測）：在時間視窗內方向反轉達 N 次、且擺幅達標，才算一次揮手。掉幀給 400ms 寬限。附帶一個好處——這個邏輯只看「方向有沒有反轉」，不看絕對方向，所以就算預覽畫面做了鏡像也完全不受影響。

![MediaPipe 手勢偵測 demo：辨識揮手動作、畫出 21 點手部骨架](/images/mediapipe-browser-presence-detection/02-gesture-detection.gif)

這兩個模組的時間全部**由外部注入**（`performance.now()` 用傳參的），所以可以餵假資料寫單元測試。

整條資料流一句話收斂：

> **鏡頭供料（影格）→ MediaPipe 轉事實（這幀有什麼）→ 狀態機轉事件（發生了什麼行為）→ 應用層轉行動（打招呼）**

每層只依賴上一層的輸出，MediaPipe 被隔離在最外圈——哪天想換成別的偵測引擎，判定層一行都不用改。

## 7. 消化偵測結果的小抄

**FaceDetector**（`result.detections[]`，每張臉一項）：

```ts
// 多人入鏡時取信心值最高的那張臉
const best = result.detections.reduce((a, b) =>
  (b.categories[0]?.score ?? 0) > (a?.categories[0]?.score ?? 0) ? b : a,
  result.detections[0])
const faceWidthRatio = best.boundingBox.width / video.videoWidth  // 距離代理
```

**GestureRecognizer**（`recognizeForVideo()`）：

```ts
const topGesture = result.gestures[0]?.[0]  // { categoryName: 'Open_Palm', score: 0.92 }
const landmarks  = result.landmarks[0]      // 21 個關節點（normalized 0~1）
const wrist      = landmarks?.[0]           // 編號 0 = 手腕
```

- 內建的靜態手勢分類有：Open_Palm / Closed_Fist / Thumb_Up / Victory / Pointing_Up / ILoveYou
- 21 個關節點編號固定：0 手腕、4 拇指尖、8 食指尖……20 小指尖
- 想畫手部骨架的話，連線表套件內建：`GestureRecognizer.HAND_CONNECTIONS`

## 8. 踩坑對照表

| 坑 | 處理 |
|----|------|
| wasm／模型走 CDN，離線環境直接掛 | 全部進 `public/` 自己 host |
| 機器沒有可用 GPU，GPU delegate 建立失敗 | GPU→CPU fallback 迴圈；實際生效哪個看 console log |
| timestamp 倒退丟例外 | 節流與推論共用同一個 `performance.now()` 值 |
| 預覽鏡像（CSS `scaleX(-1)`）害 canvas 上的文字變反字 | 畫文字時局部再翻回來一次 |
| Vite build 不做型別檢查，API 名稱拼錯不會被抓 | 直接對 `node_modules/@mediapipe/tasks-vision/vision.d.ts` grep 驗證 |
| USB 鏡頭長時間運轉偶發斷線 | 監聽 track 的 `ended` 事件，3 秒後自動重試 |
| 多模型同跑吃效能 | 手勢模型懶載入＋開關分時啟用 |

## 結語

回頭總結，這次最大的收穫有兩個。第一是**裝置端 AI 對前端的門檻真的已經很低了**：一個 229KB 的模型、幾行初始化、一個節流迴圈，瀏覽器就有了眼睛，而且影像不出裝置。第二是老派工程的價值一點沒變：**AI 給你的是機率性的逐幀輸出，把它變成可靠產品行為的，還是狀態機、遲滯、時間濾波這些古典手藝**。

除此之外也有嘗試 21 個關節點的骨架視覺化，未來也會想嘗試 MediaPipe Tasks 家族的其他成員（pose、segmentation 看起來都很有趣）。

如果你也想做一個「有眼睛」的網頁小玩具，官方文件在這：[MediaPipe Solutions guide](https://ai.google.dev/edge/mediapipe/solutions/guide)。真的不難，找個週末就能讓它跟你揮手，祝玩得愉快 👋

> 以上參數與體感皆來自自己的環境與情境，僅供參考——你的鏡頭、你的機器、你的擺位，都需要自己校準一輪。
