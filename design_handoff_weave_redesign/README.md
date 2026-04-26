# Handoff: weave-web — design fidelity pass

## 概要 (TL;DR)

`weave-web` (Next.js + Tailwind, リポジトリ: https://github.com/shin1ohno/weave/tree/main/weave-web) には既に A2 redesign の **骨格** が実装されています:

- `components/ConnectionsView/` (TopBar / DevicesPane / ConnectionsPane / ServicesPane / ConnectionCard / DeviceTile / ServiceCard / NuimoViz / RoutePill / FilterChips)
- `components/RoutesEditor/` (PresetChips / RoutesList / RouteRow / TargetBlock / TargetSwitchingBox / FeedbackRail / IdentityBlock)
- `components/TryItPanel/` (NuimoMirror / GestureChecklist / InputStreamPanel)
- `components/AppShell.tsx` で `pathname === "/"` のとき chrome を抑制し、3 ペインを full-bleed 表示

つまり**ゼロから作るタスクではありません**。同梱の HTML hi-fi モックを正として、既存実装の **デザインフィデリティを引き上げる** 修正タスクです。以下に、hi-fi モックと現実装を 1:1 で diff した結果を、ファイル単位で列挙しています。これに従って既存ファイルを編集してください。

## このバンドルの位置づけ

同梱の `weave hi-fi mockup.html` + `hifi-*.jsx` 群は、Tailwind CDN + React 18 + Babel で動く **デザインリファレンス** です。プロダクションコードではありません。
**実装の対象は `weave-web/` の既存 React/TS コンポーネント** で、対応関係は本 README の「ファイル別 diff」セクションを参照してください。

並列で同梱した `weave UX Wireframes.html` は A/B/C/D 4 案を比較した検討用の wireframe で、**実装対象ではありません**。最終案は A2 (room-less, Connection-centric)。

Fidelity: **High**。Tailwind クラス名、色トークン、間隔、状態遷移はすべて hi-fi 側で確定済み。データ型は `weave-web/lib/api.ts` の `Mapping / Route / Feedback` および `lib/devices.ts` の `DeviceSummary`、`lib/services.ts` の `ServiceSummary / ServiceTarget` にすでに合わせています。

---

## ファイル別 diff (実装の不足ポイント)

凡例: ✅ ほぼ一致 / ⚠️ 微差あり (修正推奨) / ❌ 大きく差がある (必修正)

### 1. `components/AppShell.tsx` — ⚠️

`pathname === "/"` で chrome を抑制する分岐は OK。ただし AppShell が出る他ルート (`/mappings/new`, `/stream`, `/g`, `/live` 等) のヘッダーが古いまま。

**やること**:
- AppShell ヘッダーの最大幅を `max-w-6xl` から取り除き、ConnectionsView の TopBar とビジュアル整合させる (ロゴ + zap アイコン + 検索トリガー + live バッジ + theme toggle)。
- 現在 AppShell ヘッダーには weave ロゴしかなく、TopBar と一貫性がない。`ConnectionsView/TopBar.tsx` のヘッダーを再利用するヘルパー (`<TopBar variant="appshell" />`) を抽出して両方で使うのが綺麗。

### 2. `components/ConnectionsView/TopBar.tsx` — ✅ ほぼ完璧

hi-fi (`hifi-main.jsx` の `TopBar`) と一致:
- h-14 / px-6 / `bg-zinc-900 text-white` のロゴチップ + zap
- `w-72` の検索トリガー + `⌘K` Kbd
- firing バッジ + live バッジ + theme toggle

**残作業 (任意)**:
- hi-fi にはあった右端のアバター (`<div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200…">S</div>`) が現実装にない。OSS 化を見据えるならログインユーザー表示があると望ましい (なくても可)。
- hi-fi では theme toggle の前に縦区切り `h-6 w-px bg-zinc-950/10 dark:bg-white/10` がある。視覚的なグルーピングのため追加推奨。

### 3. `components/ConnectionsView/DeviceTile.tsx` — ⚠️

構造は一致 (`NuimoViz size={56}` + nickname + `device_type · ${id.slice(-8)}` + Battery/Link2 バッジ + last input footer)。

**修正点**:
- hi-fi では `lastInput.at` の文字列をそのまま表示 (例 `"now"`, `"3s"`) し、`lastInput.input` と `lastInput.value` をスペース区切りで並べていました。現実装は `firing` のときだけ `now · ${input} ${value}` を出します。**hi-fi に合わせて**「`firing` でなくても `lastInput` があれば直近イベントを表示」に変更してください (薄文字 `text-zinc-500`)。`firing` 中はそのまま orange の LiveDot を出します。
- hi-fi の `LiveDot color="orange" firing` は ping アニメーション付き。現実装は `bg-orange-500 animate-pulse` の単純ドット。`<LiveDot>` 相当を `components/ui/` に切り出して **ping レイヤー (`absolute inline-flex animate-ping opacity-75`) を追加** してください。

### 4. `components/ConnectionsView/ConnectionCard.tsx` — ❌ 主要差分あり

hi-fi (`hifi-connection.jsx`) と現実装の差分:

| 項目 | hi-fi | 現実装 | 修正方針 |
|---|---|---|---|
| デフォルト枠線 | active: `border-zinc-950/10 shadow-sm hover:border-zinc-950/20`、inactive: `border-dashed border-zinc-950/10 bg-zinc-50/40` | `Card variant="inactive"` の dashed が抜けている疑い | `components/ui/card.tsx` の `variant="inactive"` で `border-dashed border-zinc-950/10 bg-zinc-50/40 dark:bg-zinc-950/60` を出すか、ConnectionCard 内で直接当てる |
| firing リング | `border-orange-500/60 ring-2 ring-orange-500/30 shadow-sm` | OK (`Card variant="firing"`) | — |
| firing バッジ位置 | `absolute -top-2.5 right-3` | OK | — |
| firing dot | `<LiveDot color="orange" firing/>` (ping レイヤー付き) | `h-2 w-2 animate-pulse rounded-full bg-orange-500` | LiveDot コンポーネントに統一 |
| edit/delete ホバー | edit + delete 2 ボタンが `opacity-0 group-hover:opacity-100` | edit (Pencil) + ChevronDown のみ。delete ボタンがない | 削除アクションが既に Routes editor 内にあるなら割愛可。ただし「カード自体から削除」は UX として有用なので追加推奨 |
| 行末 add-route リンク | `<button>+ route</button>` (dashed border、`text-blue-600` hover) を routes pill 群の末尾に常時表示 | なし。expand クリックでしか route を追加できない | hi-fi に合わせて末尾に `+ route` の dashed pill を追加。クリックで `setExpanded(true)` |
| meta footer の「Switch on …」 | `swipe_u` 等の Glyph アイコン付き | テキストのみ | アイコン追加 (input glyph mapping は `components/icon.ts` に揃える) |
| 中央の connector | active/inactive で線と矢印の色を切替 | 同等 | OK |

### 5. `components/ConnectionsView/RoutePill.tsx` — ⚠️ 確認のみ

`hifi-connection.jsx` の `RoutePill` は input → intent を short label に変換 (`INPUT_SHORT` / `INTENT_SHORT` テーブル) して描画。現実装の RoutePill (4225 bytes、未読だが) も同等のはず。**short label テーブルが揃っているか確認** し、足りない gesture/intent があれば `RoutesEditor/vocab.ts` から取り込んで補完。

### 6. `components/ConnectionsView/ServiceCard.tsx` — ⚠️

hi-fi に対する差分:
- hi-fi では headline 右端に `<Badge color="green"><LiveDot color="green"/>{service.status}</Badge>` (running/offline ではなく status 文字列をそのまま表示)
- 現実装は `running ? "running" : "offline"` の二値 + LiveDot なし

**修正**: LiveDot を入れ、文字列は `service.running ? "running" : "offline"` のままで OK。LiveDot の有無で生死感が大きく変わります。

### 7. `components/ConnectionsView/ConnectionsPane.tsx` — ⚠️

- hi-fi では `+ New connection` の dashed CTA の **下に** `or drag a Device tile onto a Service target` というヒントテキスト (`font-mono text-[11px] text-zinc-400 text-center`) があります。現実装にはなし。**追加してください** — drag による作成は将来実装するとしても、UX のヒントとして残す価値があります。
- `FilterChips` の見た目: hi-fi は `rounded-lg border bg-white p-0.5` の inner segmented control、active は `bg-zinc-900 text-white dark:bg-white dark:text-zinc-900`。`FilterChips.tsx` (1042 bytes) を一度開いて一致を確認してください。

### 8. `components/ConnectionsView/DevicesPane.tsx` — ⚠️

- 「Pair」ボタンが `disabled` のまま。hi-fi ではアクティブな Button。実装方針が固まったら enable に。今は disabled tooltip で OK。
- hi-fi では devices の下に **Input stream ミニパネル** (3 行ほどの最新イベント) が同居しています。現実装は別ペインに分離されていません。**追加するなら**: DevicesPane の下端に `max-h-[120px]` で `InputStreamPanel` の compact variant を埋め込む。優先度は中。

### 9. `components/ConnectionsView/ServicesPane.tsx` — ⚠️

- hi-fi では Services の下に **Edges mini panel** (edge ごとの connection / latency / wifi state) が同居しています。現実装にはなし。**Edge disconnected の警告** が見えるよう、`SERVICESPANE` 末尾に簡易 Edge list を追加してください (型: `EdgeInfo` が `lib/api.ts` にある想定)。

### 10. `components/RoutesEditor/index.tsx` — ❌ レイアウトが大きく違う

hi-fi (`hifi-routes.jsx`) は **`max-w-[880px]` カード + `grid-cols-[1fr_260px]` の 2 カラム** (左: Preset / Routes / Target switching、右: Device preview + Feedback mini)。

現実装は **縦 1 カラム** で、Target / Routes / Target switching / Feedback / Identity を accordion で並べる構造。差分:

- ❌ 右ペインの **Device preview (NuimoViz size 96 + Try it now ボタン)** がない。RoutesEditor の真横に live mirror が出ることで、編集中の効果が即見えるのが A2 の主張。
- ❌ 左ペイン上段の **Preset chips** は実装あり (`PresetChips.tsx`) だが、hi-fi では rounded-full の chip 群 + `Music default` が `border-blue-500 bg-blue-50 text-blue-700` で active。現状の見た目を確認してください。
- ❌ Target switching が hi-fi では「ライト」(段組内 `bg-zinc-50` ボックス + iOS 風トグル + `On swipe_up cycle: Living → Kitchen + add target` の inline UI)。現実装は accordion 内 `TargetSwitchingBox`。**hi-fi の inline UI に書き換え**、別ファイル (`TargetSwitchingBox.tsx`) は捨ててインラインで持って OK。
- ❌ Identity block は hi-fi では存在しない (advanced collapsible として実装側で追加されたもの)。残してよいが **デフォルト閉じ** で。
- ⚠️ Save/Cancel/Duplicate ボタンが hi-fi ではヘッダー右端 (`Duplicate` plain / `Cancel` outline / `Save` blue)。現実装は footer。**ヘッダー右に移動** すると hi-fi に揃います。

**やること** (順序付き):
1. RoutesEditor の root を `max-w-[880px] mx-auto` に変更し、`grid-cols-[1fr_260px] gap-6 p-5` を導入。
2. 右カラム = `<DevicePreviewMini>` (NuimoViz 96px + nickname + `Try it now` orange button → `useTryIt().openFor(mapping)`) + `<FeedbackRail>` を移植。
3. 左カラムに PresetChips / RoutesList / TargetSwitchingInline。
4. Save/Cancel/Duplicate をヘッダー右へ。
5. Identity / Feedback の collapsible は維持してよい。ただし inline variant では default closed。

### 11. `components/RoutesEditor/RouteRow.tsx` — ⚠️

hi-fi (`hifi-routes.jsx` の `RouteRow`) との差分:
- ✅ drag handle + input pill + `→` + intent pill + params chip + close
- ⚠️ params chip (例 `damping 80`) のスタイル: `bg-zinc-50 px-2 py-1 font-mono text-[11px]`。実装側 (3230 bytes) を確認し、damping/scale 等の数値パラメータが見える形で出ていることを確認してください。
- ⚠️ 未割当 (`empty`) 行は `border-dashed border-zinc-300` + `+ pick intent…` の blue link。実装でも **未割当ジェスチャ提案行** を 3 つまで自動表示する設計が hi-fi にあります (`unusedGestures.slice(0,3)`)。現実装の `RoutesList` で同等が出ているか確認。なければ `vocab.ts` の `INPUT_TYPES` を使って未使用 input 上位 3 件をサジェスト行として描画してください。

### 12. `components/TryItPanel/index.tsx` — ⚠️ レイアウト差

hi-fi (`hifi-tryit.jsx`) は `grid-cols-[300px_1fr]` の **上半分 = mirror + checklist**、**下半分 = InputStream の表組み**。現実装は flex 横 2 カラム + InputStream を右下に押し込み。

**修正方針**:
- 現状の slide-in drawer (`fixed right-0 max-w-3xl`) は維持してよい。
- 内部レイアウトを **vertical 2 セグメント** に変更:
  - 上: `grid grid-cols-[300px_1fr] gap-4 p-4` で NuimoMirror + GestureChecklist
  - 下: `border-t` + InputStreamPanel (`max-h-[240px]`)
- GestureChecklist の上端に **進捗バー** (`<div className="h-2 rounded-full bg-zinc-100"><div className="h-full bg-green-500" style={{width: pct%}}/>`)。ok 件数 / 全 gesture を計算して反映。
- 各 ChecklistRow の左端に状態アイコン (✓ green / ! orange / dot zinc)。

### 13. `components/TryItPanel/InputStreamPanel.tsx` — ⚠️ 巨大化注意 (18986 bytes)

hi-fi の InputStream は monospace 表組み 6 列 (`timestamp / device / input / value / → / intent / ok`)。最新行に `animate-pulse` を 1.5s 付与。**Pause/Clear ボタン** + `all devices` バッジ + `<LiveDot color="orange" firing/>` をヘッダーに。

**やること** (確認のみで OK):
- 最新行のフラッシュ演出があるか
- Pause / Clear が実装されているか
- フィルター (mapping ごと) の有無は `mappingFilter()` で済んでいる

巨大なので大改修不要。ヘッダーの `LiveDot` だけ ping レイヤー版に統一してください。

### 14. `components/ui/` 全般 — ⚠️ LiveDot コンポーネント不足

`hifi-atoms.jsx` の `<LiveDot color firing/>` (`bg-{color}-500 + animate-ping overlay`) を `components/ui/live-dot.tsx` として作成し、TopBar / ConnectionCard / ServiceCard / DeviceTile / TryItPanel から使ってください。現状あちこちで `h-2 w-2 animate-pulse rounded-full bg-orange-500` 的な inline 表現が散らばっており、ping アニメが付いていません。

```tsx
// components/ui/live-dot.tsx
const COLORS = {
  green: "bg-green-500", orange: "bg-orange-500",
  zinc: "bg-zinc-400", red: "bg-red-500", blue: "bg-blue-500",
} as const;
export function LiveDot({color = "green", firing = false}: {color?: keyof typeof COLORS; firing?: boolean}) {
  return (
    <span className={`relative inline-flex h-2 w-2 flex-shrink-0 rounded-full ${COLORS[color]}`}>
      {firing && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${COLORS[color]} opacity-75`} />}
    </span>
  );
}
```

### 15. `components/icon.ts` — ⚠️ glyph 充足

hi-fi は `Glyph` で 24 種を inline SVG (lucide 風)。現実装は `components/icon.ts` (2277 bytes) に集約されているはず。**未収録の glyph** (特に `swipe_l/r/u/d`, `rotate`, `long_press`, `drag`, `wifi_off`) があれば追加してください。

---

## Design tokens (確認用)

Tailwind デフォルトに準拠、特記:

- **Background**: `zinc-50` (light) / `zinc-950` (dark)
- **Surface**: `white` / `zinc-900`
- **Border**: `zinc-950/5` (light) / `white/10` (dark)。ホバー時 `/10`→`/20`
- **Muted text**: `zinc-500` / `zinc-400`
- **Accent (firing / try-it)**: `orange-500` / `orange-600`
- **Primary action (Save / select)**: `blue-500` / `blue-600`
- **Success**: `green-500` / `green-600`
- **Warn**: `amber-400`
- **Radius**: cards `rounded-xl` (12), chips `rounded-md` (6), pill `rounded-full`
- **Shadow**: `shadow-sm` のみ多用、firing は `ring-2 ring-orange-500/30`
- **LED matrix**: 8×8 grid、cell 5px+gap 1px、off `rgba(255,255,255,0.06)`、on `#f97316` + `box-shadow: 0 0 4px rgba(249,115,22,0.8)`
- **Sans**: system stack (Geist は使わない方針 — OSS 化を意識)
- **Mono**: `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` for IDs / addresses / timestamps
- **Sizes**: `text-xs (12)` / `text-sm (14)` / `text-base (16)` / `text-lg (18)`、見出しは `font-semibold tracking-tight`

---

## 推奨実装順序

1. **`components/ui/live-dot.tsx`** を作成し、TopBar / ConnectionCard / ServiceCard / DeviceTile / TryItPanel の inline dot を全部置き換え (1 PR で済む小タスク、視覚効果が大きい)
2. **ConnectionCard** の差分を全部適用 (inactive dashed / + route 末尾 / footer の icons / delete ボタン)
3. **DevicesPane / ServicesPane** にミニサブパネル (Input stream / Edges) を追加 — 余裕があれば
4. **RoutesEditor の 2 カラム再構築** — 中規模
5. **TryItPanel の vertical 2 segment 化** + 進捗バー
6. **AppShell ヘッダー** の TopBar 化 (両者で再利用)
7. **glyph icon** の不足分追加

---

## 同梱ファイル

- `weave hi-fi mockup.html` — エントリ (Tailwind CDN + Babel + React 18)
- `hifi-atoms.jsx` — Glyph / Badge / Button / NuimoViz / LiveDot / Card / Kbd
- `hifi-data.jsx` — デモデータ (実装では `lib/api.ts`, `lib/devices.ts`, `lib/services.ts` を使う)
- `hifi-connection.jsx` — **ConnectionCard** + `RoutePill` (中央ペインの主役)
- `hifi-main.jsx` — Main view (3 pane) + TopBar / DeviceTile / ServiceCard / ServiceTargetRow / GestureChip
- `hifi-routes.jsx` — Routes editor + RouteRow (2 カラムレイアウト正典)
- `hifi-tryit.jsx` — Try it panel + InputStreamPanel + ChecklistRow
- `hifi-flow.jsx` — 6-step storyboard (reference only、実装対象外)
- `hifi-app.jsx` — design canvas 上のアートボード配置
- `design-canvas.jsx` — 閲覧用キャンバス (実装には不要)
- `weave UX Wireframes.html` — 検討過程の wireframes (reference only、実装対象外)

## ターゲットコードベース

- リポジトリ: https://github.com/shin1ohno/weave
- パス: `weave-web/` (Next.js App Router + Tailwind + Headless UI + Catalyst-style atoms)
- 既存の対応コンポーネント:
  - `components/ConnectionsView/*` — 3-pane main view
  - `components/RoutesEditor/*` — connection editor
  - `components/TryItPanel/*` — validation panel
  - `components/AppShell.tsx` — chrome (suppressed on `/`)
  - `components/CommandPalette.tsx` — ⌘K
  - `components/ui/*` — atoms (Badge / Button / Card / Kbd / Switch / Dialog / Heading / Text / Separator)
  - `lib/api.ts` / `lib/devices.ts` / `lib/services.ts` / `lib/ws.ts` — types & WS state
  - `hooks/useTryIt.ts` / `useMappingDraft.ts` / `useTheme.ts` / `useCommandUI.ts`

## Claude Code への指示テンプレ

> `weave-web/` の既存実装を、同梱の `weave hi-fi mockup.html` (および `hifi-*.jsx`) に忠実にアップデートしてください。**README.md の「ファイル別 diff」セクションに列挙された差分** を上から順に潰す方針で進めてください。
>
> 既存のデータプラミング (`useUIState`, `useFiringMappingIds`, `useMappingDraft`, `summarizeDevices/Services`) は変更しないでください。**ビジュアル + 配置 + アニメーション** のみが対象です。
>
> 各タスク完了ごとに、対応する hi-fi コンポーネント (`hifi-connection.jsx` の `ConnectionCard` など) と並べてセルフレビューしてください。
