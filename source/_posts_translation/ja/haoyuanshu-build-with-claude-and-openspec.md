---
title: "SDD 開発フロー実践：Claude のツール群で誦経記録アプリ「好願書」を作る（iOS）"
date: 2026-05-08 14:30:00
lang: ja
translation_key: haoyuanshu-build-with-claude-and-openspec
description: 二つの週末で iOS 誦経記録アプリ「好願書」を制作。Claude Design で発想、openspec で仕様化、Claude Code で実装。SDD（仕様駆動開発）と AI 協業の実践記録 ── 任せていい仕事と、任せてはいけない仕事。
categories:
  - 技術
tags:
  - AI
  - Claude Code
  - Claude Design
  - openspec
  - React Native
  - Expo
---

子どもの頃、祖母が念珠を回しながらお経を唱え、小さなカウンターで回数を記録していたのを覚えている。大人になって自分も心経を唱えるようになり、回向の対象や目的が違うたびに既存アプリでは使いにくいと感じ、二つの週末を使って自分用のアプリを作った。Claude Design で UI を発想し、openspec で仕様を固め、Claude Code で React Native + Expo を実装し、最後は自分の iPhone で検証した、という流れだ。

もう一つの動機は **SDD（Spec-Driven Development、仕様駆動開発）** をこのプロジェクトで実際に試すことだった。先に spec を書き、AI に spec 通りに実装させる ── このやり方が本当に vibe coding より安定して追跡しやすいのかを確かめたかった。好願書は自分への練習問題だった。

この記事ではフロー全体と、AI と協業するうえで踏んだ地雷・選んだトレードオフを記録しておく。

<!-- more -->

## なぜ「好願書」なのか

まずこのアプリが何を解決するかを書いておく。

誦経系のアプリは市場にいくつもあるが、ほとんどに二つの問題がある。一つは UI が「派手」すぎること ── 金ぴかのボタン、跳ねるカウンター、広告だらけ ── 「静心」とは真逆。もう一つは数え方のモデルがズレている。誦経者が本当に気にしているのは「誰のために、何のために、何遍誓ったか、誰に回向するか」であって、増えていく数字そのものではない。

そこで「電子化された功徳帳」があったら、と考えた。

- **二つのモード**：構造化された誓願（毎日 108 遍を 49 日続ける、など）と、自由に記録するだけのデイリーモード。両方サポートする。
- **没入誦経**：木魚を叩くと音が鳴り、波紋が広がる。ただし **木魚は遍数をカウントしない** 。遍数は ±1 ボタンで手動加減する ── 言い間違い、やり直し、飛ばしは現場では普通。自動カウントはむしろ集中を奪う。
- **功徳の封存**：完了した誓願は、流れ去るのではなく儀式感を伴って「アーカイブ」される。
- **ローカルファースト**：登録不要、アップロード不要、すべて端末内（クラウド同期は将来追加するかもしれない）。

技術スタックは最終的に React Native + Expo SDK 54、TypeScript、Zustand、AsyncStorage、expo-av、expo-notifications になった。ただし本記事は技術選定の話ではなく、 **AI がフロー全体にどう関わったか** が主題だ。

## 三段階の AI ワークフロー

プロジェクトを三段階に分け、それぞれにツールを一つ割り当てた。

| 段階 | ツール | 成果物 |
|---|---|---|
| UI/UX 発想 | Claude Design | 10 画面の HTML プロトタイプ |
| 仕様化 | openspec | proposal / design / tasks の三つの文書 |
| 実装 | Claude Code | 動く Expo + RN コード |

そして第四段階として **iPhone 実機での受け入れ確認** ── ここだけは AI に任せられなかった。

合言葉は **「各段階で AI に一つの仕事を任せる。ただしどの段階も AI 完全自動ではない」** 。ハンドルはずっと自分が握っていた。

## Stage 1：Claude Design が頭の中の「禅」を HTML に変える

最初のプロンプトはこうだった：

> 誦経アプリを作りたい。ビジュアルは静かな禅の路線：和紙の白地、墨の黒、朱砂の赤を差し色に、思源宋体（Source Han Serif）。10 画面を設計してほしい：onboarding、ホーム、計画作成、本日の誦経、没入モード、円満回向、功徳封存、設定、デイリーモード、心経のドロワー。各画面を HTML プロトタイプで。

Claude Design が返してきたのは 10 個の HTML モックアップ。色とタイポグラフィはおおむね方向通り。デザイン言語の可視化は意外と上手で ── 赤い印章（Seal） + 黒い細罫（Hairline） + 和紙テクスチャ背景の組み合わせ ── このジャンルへの下準備があるように見えた。

![モード選択画面](/post/2026/05/haoyuanshu-build-with-claude-and-openspec/01-onboarding.png)

ただし Claude Design には粗もある：

1. **HTML は静的、インタラクションが限定的** 。木魚タップの波紋アニメーションや bottom sheet のドラッグは静止状態の示唆にしかならない。
2. **デザイン token が自動で引き継がれない** 。3 画面目で強調した「朱砂紅 #B7332B」は、7 画面目では「朱紅 #C04A3D」に変わっていた。プロトタイプ段階では問題ないが、Claude Code に渡すときには地雷になる ── 自分で揃え直す必要がある。

私の対処は、プロトタイプを一枚の design token 表に「翻訳」することだった：

```ts
// 10 個の HTML から抽出したデザイン token。
// 後続のすべての RN コンポーネントはこのファイルだけを参照する。
export const lightTokens = {
  bg: '#F5EFE3',           // 和紙の地色
  ink: '#1F1A14',          // 墨黒
  cinnabar: '#B7332B',     // 朱砂（印章 / 強調）
  goldLeaf: '#C8A75A',     // 金箔（補助強調）
  moss: '#5C7757',         // 苔緑（成功状態）
  hairline: '#1F1A1422',   // 半透明黒（細罫）
  paper: '#EFE6D2',        // カード紙色
  fontSerif: 'NotoSerifTC_400Regular',
};
```

この token 表が以後 Claude Code にとって唯一の視覚的真実になった ── プロトタイプのスクリーンショットはあくまで「示唆」として扱い、色・余白・字級はすべてこのファイルを reference させた。 **この小さな規律が、後の視覚調整時間を大きく節約してくれた** 。

## Stage 2：openspec は spec のバージョン管理

vibe coding の最大の問題はこうだ：AI に「X を作って」と頼み、AI は一塊のコードを返し、ざっと見て OK そうなので merge する。三日後に Y をやりたくなり、AI は脈絡を読み直す ── そしてその理解はあなたの記憶と食い違っている。

openspec はこれを「変更ごとにファイルに書き起こす」方式で解決する：

```
openspec/changes/haoyuanshu-expo-app/
├── proposal.md   # Why + What changes（人間向け）
├── design.md     # 技術判断、データモデル、インタラクション
└── tasks.md      # 一行ずつのチェックボックス（AI が走らせる）
```

実際の `proposal.md` はおおよそこんな感じ：

```markdown
## Why
好願書は心経の誦経を中心に据えた iOS 禅風アプリ。現状は HTML
プロトタイプ（10 画面）しかないため、Expo + React Native +
TypeScript ネイティブ実装に転換する必要がある。

## What Changes
- 新規 Expo (SDK 52+) + React Native + TypeScript プロジェクトを作成
- 木魚タップは実音を再生するが **遍数はカウントしない** ；
  遍数は ±1 ボタンで制御
- 計画データはすべて AsyncStorage にローカル保存
- **当面の対象外** ：クラウド同期、アカウントシステム

## Capabilities
- woodfish-counter：木魚コンポーネント + 遍数カウントロジック
- plan-management：誓願計画 CRUD + 90 日ヒートマップ
- ...
```

proposal + tasks を書ききるのに少し時間がかかった ── アプリ全体を一度頭の中で走らせるのに等しい。だがこの前払いコストは三つの理由で見合った：

1. **AI は spec のほうがスクリーンショットより正確に読む** 。スクリーンショットの細部（このボタンを押すとどこへ、空状態はどう見えるか、権限拒否でどうなるか）は一目では追えない。spec で固定しておけば AI はぶれない。
2. **tasks.md がプログレスバーになる** 。Claude Code を開くたびに「次の未チェック task を実行して」と言うだけ。実行→チェック→ review→ git commit。追跡可能、巻き戻し可能。
3. **spec とコードが食い違ったら、spec が source of truth** 。このルールが、後に Claude が指示を勝手に再解釈しようとした場面で何度も助けになった。

正直なところ、openspec の価値はあの三つの markdown フォーマットの魔力ではない。 **着工前に問題を考え抜くことを強制する** という点にある。

## Stage 3：Claude Code + tasks.md のペア作業

実装段階のリズムはこうだった：

```
私：           tasks.md の 5.X 系列を実行（木魚コンポーネント）
Claude Code：  [Woodfish.tsx, useWoodfishAudio hook を編集...]
私：           git diff を確認 → simulator で動作確認 → チェック / 差し戻し
```

一番手応えがあったのは Zustand store のところだ。「起動時に AsyncStorage から復元、更新ごとに自動で書き戻す」と説明したら、AI は私の頭の中の版とほぼ同じ構造を返してきた：

```ts
// src/store/index.ts（抜粋）
const persist = (key: string, value: unknown) => {
  AsyncStorage.setItem(key, JSON.stringify(value)).catch((e) => {
    console.warn(`[store] ${key} への書き込み失敗:`, e);
  });
};

export const useStore = create<AppState>((set, get) => ({
  plans: [],
  hydrated: false,

  hydrate: async () => {
    const [plansStr, logsStr, settingsStr] = await Promise.all([
      AsyncStorage.getItem(KEYS.plans),
      AsyncStorage.getItem(KEYS.dailyLogs),
      AsyncStorage.getItem(KEYS.settings),
    ]);
    set({ plans: plansStr ? JSON.parse(plansStr) : [], /* ... */ hydrated: true });
  },

  addPlan: (plan) => {
    const plans = [...get().plans, plan];
    set({ plans });
    persist(KEYS.plans, plans);  // 書き込みごとに storage へ同期
  },
}));
```

しかしより多くの場面で、AI は **幻覚を見る** 。

一番印象に残っている例：tasks.md の 7 番目は「Onboarding でモードを選んだら store に保存しメイン画面へ遷移」だった。Claude は「完了」と返してきたが、git diff を見ると ── 確かに `OnboardingScreen.tsx` を編集していた、しかし **実際には `updateSettings({ appMode })` を呼んでいなかった** 。`console.log` を一行追加しただけ。simulator で動かすと、モードを選んで再起動しても onboarding に戻ってきた。

その日以来、自分にひとつルールを課した： **git diff こそが ground truth。AI が「完了」と言っても完了じゃない** 。一つの task が終わるたびに必ず diff を読む。読んでいないならチェックしない。

![誓願計画作成画面](/post/2026/05/haoyuanshu-build-with-claude-and-openspec/03-create-plan.png)

### AI と協業するうえでのデザイン判断

途中、AI の「デフォルト」と意見が割れて、自分の判断を貫いた箇所が二つある：

**1. 木魚はカウントしない**

Claude Code の初版では、木魚をタップすると音が鳴り **同時に自動で +1** されていた。技術的には合理的だが、儀軌的には違う ── 実際に唱える人は言い間違い、やり直し、飛ばしを日常的にやる。自動カウントはむしろ焦りを生む。spec に書いた「木魚は音だけ、カウントは独立ボタンで」に戻させた。再実行で AI も納得したが、押し戻さなければデフォルトのまま吸収されていた。

**2. 没入モードは何も表示しない**

AI のデフォルトは toolbar、字級調整、bottom tab を追加することだった、「使いやすくするため」と。だが没入モードの目的は **干渉を減らす** ことだ。要素を 80% 削り、木魚・遍数・一時停止だけ残した。これを design.md に「没入モードは hide everything except: 木魚、遍数、一時停止」と書き付けたところ、以降 AI は勝手に画面を足さなくなった。

![没入誦経モード](/post/2026/05/haoyuanshu-build-with-claude-and-openspec/05-immersive.png)

## Stage 4：iPhone 実機の地雷三連

simulator は嘘をつく。実機が真実だ。

**地雷 1：Apple ID 署名**
最初に `npx expo run:ios --device` を走らせ、build が通り、iPhone にインストールされ、開いたら **即クラッシュ** 。原因は Apple ID 開発者証明書を端末が信頼していないこと ── 「設定 → 一般 → VPN とデバイス管理」で手動信頼が必要。どのチュートリアルにも書かれているが、ネイティブアプリを書いたことがない自分は少し止まった。

**地雷 2：expo-av の初回再生遅延**
木魚を simulator で叩くと音は瞬間的に鳴る。実機で叩くと **約 200ms の遅延** がある。原因は `Audio.Sound.createAsync()` の初回再生で codec デコードが走るため。実機ではこれが目立つ。解決策は sound オブジェクトを ref にキャッシュし、アプリ起動時にプリロードすること：

```tsx
const soundRef = useRef<Audio.Sound | null>(null);

const loadAndPlay = useCallback(async () => {
  if (muted) return;
  if (!soundRef.current) {
    const { sound } = await Audio.Sound.createAsync(woodfishWav);
    soundRef.current = sound;
  }
  await soundRef.current.setPositionAsync(0);
  await soundRef.current.playAsync();
}, [muted]);
```

AI の初版はキャッシュをしていなかった（simulator では差を感じないため）。実機で走らせて初めて発覚した。

**地雷 3：expo-notifications の権限**
`Notifications.scheduleNotificationAsync()` は simulator では何の問題もなく成功するが、実機では先に `requestPermissionsAsync()` が必要。しかも iOS は二度目のプロンプトを出してくれず、ユーザーが一度拒否したら設定画面から手動で開けるしかない。AI の初版は permission flow をまったく扱っていなかった ── 実機で「リマインダーを有効にする」を押しても無反応で気づいた。

三つの問題に共通するのは **simulator では再現せず、AI には simulator が見えない** ということ。実機検証は AI には頼れない。

![円満回向画面](/post/2026/05/haoyuanshu-build-with-claude-and-openspec/06-complete.png)

## 振り返り：AI に丸投げできないものは何か

二週末の経験を整理すると、こう分けられる：

| AI に任せていい | AI に任せてはいけない |
|---|---|
| 雛形コード（component scaffold、型定義） | アプリを作る *理由* |
| spec で書き切られた細部の実装 | spec そのものを書くこと（user の欲求は自分にしか分からない） |
| Refactor、命名、TypeScript の型 | Design system / token の最終決定 |
| 小さな bug 修正、`console.log` を足してデバッグ | 「完了」の定義（`git diff` だけが基準） |
| 入出力が明確な単体テスト | 実機での受け入れ確認（AI には見えない） |

最大の学びは **spec はプロンプトより価値がある** ことだ。きちんと書いた proposal + tasks 一覧があれば、AI は N 回の対話を跨いでも同じ方向を保つ。逆に毎回プロンプトで脈絡を再説明すれば、AI は毎回「再解釈」し、答えがそのたびに違ってくる。

openspec は魔法の framework ではない。その本当の価値は **着工前に問題を考え抜くことを強制する** 点にある ── これは AI には肩代わりできない。

![功徳封存ページ](/post/2026/05/haoyuanshu-build-with-claude-and-openspec/07-archive.png)

## おわりに

二つの週末で、自分の iPhone で動くアプリを完成させた。三年前なら考えられなかったことだ。普段は Vue のフロントエンドを書いており、React Native はほとんど触っておらず、Expo は今回初めて開いた。それでも、Claude Design が UI 発想を、openspec が spec 固定を、Claude Code が RN + TypeScript の細部実装を担ってくれたおかげで、自分がやることは **方向を握り、git diff を読み、実機で確認する** だけで済んだ。

もちろん「AI が私のコーディングを置き換えた」とは言わない ── 木魚をカウントしない判断、署名地雷の解決、実機 200ms 遅延の最適化、どれも AI にはできなかった。

しかし AI が「作りたい → 作れる → 作り終えた」までの距離を大きく縮めたのは確かだ。 **今いちばんのボトルネックは「書けるかどうか」ではなく「作りたいか、何を作るかが分かっているか」** に移った。

今は毎日 iPhone で好願書を開いて心経の記録をつけている ── 自分の痛みは解消された。次は端末間のクラウドバックアップ、あるいは家族に功徳を共有する機能になるかもしれない。だがそれは次の openspec change の話だ。

---

> ソースコードは GitHub: [haoyuanshu](https://github.com/superbeeee)（整理中）。Claude Design + openspec + Claude Code のこのワークフローを試したい方は、お気軽にご連絡ください。
