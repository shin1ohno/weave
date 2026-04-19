# weave: IoT Device ↔ Service Routing

## Summary

物理 IoT デバイス（Nuimo、StreamDeck、HueDial 等）の操作を、サービス（Roon、照明、エアコン等）のコマンドに変換するルーティング基盤。**2 つの独立した経路を並存させる設計**:

- **直結 edge-agent 経路（推奨 / 低レイテンシ）**: 各デバイスホストで `edge-agent` バイナリが稼働。Nuimo 等の BLE デバイスをローカルで受け、Rust SDK 経由で Roon/Hue 等に直接コマンドを打つ。weave-server とは WebSocket で config / state をやり取り。
- **MQTT 経路（N:N クロスホスト向け）**: デバイス driver（例: `nuimo-mqtt`）とサービス adapter（例: `roon-hub`）が MQTT broker を挟んで疎結合に疎通。weave-engine が入力 primitive → サービス intent のルーティングを担う。

両経路とも同じ weave-server を設定基盤として共有する。マッピングは REST API + Web UI 経由で動的変更可能。

## Requirements

### Must

1. **操作プリミティブ → 意図変換**: デバイスの物理操作 (rotate, press, long_press, swipe, slide, hover) をサービスの意図 (play, volume_change, next, brightness_change) にマッピング
2. **設定駆動のマッピング**: マッピングは SQLite に永続化。コード変更なしでマッピングを追加・変更可能
3. **動的変更**: REST API で更新した瞬間に edge-agent へ `config_patch` を push。edge-agent 再起動不要
4. **複数デバイス → 複数サービス**: N:M マッピング。1 台の Nuimo が Roon volume と照明 brightness を同時制御可能
5. **Zone/Target 動的切替**: REST `POST /api/mappings/{id}/target` で切替。edge-agent に即時反映
6. **BLE 切断時のグレースフル動作**: edge-agent がローカルでマッピングをキャッシュ保持。BLE 再接続時に復帰
7. **低レイテンシ**: Nuimo rotate → Roon volume 変更の体感遅延 < 100ms（直結経路で実測 <10ms 目安）
8. **Web UI**: Next.js でマッピング設定・live state 表示・glyph 編集・edge 一覧・target 切替
9. **フィードバックループ**: サービスの状態変更 → デバイスの表示更新（Roon playing → Nuimo LED play icon）
10. **dampingFactor / 感度設定**: rotate → volume の変換係数を per-route に設定可能

### Should

11. **Glyph ライブラリ**: weave に集約、Web UI で編集。ASCII プレビュー併記の 9x9 click-to-toggle エディタ
12. **プリセット**: よく使うマッピング（Nuimo+Roon、StreamDeck+照明）のテンプレート
13. **MCP tools**: Claude から `list_mappings`, `update_mapping`, `switch_target` を呼べる

### Could

14. **条件付きルーティング**: 時間帯やモードによってマッピングを切り替え
15. **マクロ**: 1 操作で複数サービスに同時発行
16. **デバイス操作での zone 切替**: Nuimo の特定ジェスチャーで zone 切替

## Non-requirements

- デバイスの BLE 接続管理（edge-agent / nuimo-mqtt が担当）
- サービスの直接制御ロジック（adapter-roon / roon-hub が担当）
- ユーザー認証・マルチテナント（シングルユーザー・LAN 閉域前提）

## Technical Approach

### 経路 A: 直結 edge-agent（推奨）

```
[edge-agent × N] (デバイスホストごと)                 [weave (サーバ)]
 ├ device driver (nuimo / streamdeck / ...)          ├ SQLite
 ├ routing engine (primitive → intent)               ├ REST API (axum)
 ├ service adapters (Cargo feature)                  ├ /ws/edge (config push, state receive)
 │  ├ adapter-roon → Roon Core via roon-api          ├ /ws/ui   (state fan-out, mapping/glyph diff)
 │  └ adapter-hue  → Hue Bridge                      └ Next.js Web UI
 └ ws client (/ws/edge) ─────── WebSocket ──────────►
                                                      ▲
                                                      │ ブラウザから /ws/ui
```

- edge-agent は自前の `extension_id` で Roon に登録し、同一 LAN 上の Roon Core と直接 MOO RPC
- config_server 不在時はローカルキャッシュ (`~/.local/state/edge-agent/config-cache-${edge_id}.json`) で稼働継続

### 経路 B: MQTT bus（N:N クロスホスト向け）

```
デバイス層                      ルーティング層                  サービス層
──────────                    ───────────                    ────────
nuimo-mqtt ──┐                 weave (-engine)          ┌── roon-hub
streamdeck ──├→ mosquitto ──→ ├ subscribe device/+    ──→ mosquitto ──┤── hue-bridge
huedial ─────┘                 └ publish  service/+           └── aircon-ctrl
```

- topic 規約:
  - `device/{type}/{id}/input/{primitive}` — デバイス入力
  - `service/{type}/{target}/command/{intent}` — サービス コマンド
  - `service/{type}/{target}/state/{property}` — サービス 状態（retained）
  - `device/{type}/{id}/feedback/{type}` — デバイス フィードバック
- `roon-hub` は単一のコンテナが mosquitto 経由でコマンドを受け、Roon state を retained publish
- ホスト A の StreamDeck → ホスト B の Hue、のような跨ぎ運用が自然

### どちらを選ぶか

| 判断軸 | 直結 edge-agent | MQTT 経路 |
|---|---|---|
| デバイス数 | N ≤ 5、同一 LAN | N 規模で地理的に分散 |
| レイテンシ要件 | <10ms 望む（音量操作など） | <100ms で許容 |
| 障害分離 | エッジごとに独立 | broker が単一障害点 |
| クロスホスト N:M | 追加設計が必要 | バス上で自然 |
| 複数の独立した dashboard | /ws/ui から fan-out | retained message で各購読者が state 同期 |
| 運用負担 | エッジホストごとに 1 プロセス | broker + 各 adapter プロセス |

家庭内・Roon 1 台・ホスト近接 Nuimo の本プロジェクトでは **A が主**、将来 N:N に広げたくなった時用に B を温存している。

### マッピング設定

```json
{
  "mapping_id": "uuid",
  "edge_id": "living-room",
  "device_type": "nuimo",
  "device_id": "C3:81:DF:4E:FF:6A",
  "service_type": "roon",
  "service_target": "16017ec931848...",
  "routes": [
    {"input": "rotate", "intent": "volume_change", "params": {"damping": 80}},
    {"input": "press",  "intent": "play_pause"}
  ],
  "feedback": [
    {"state": "playback", "feedback_type": "glyph", "mapping": {"playing": "play", "paused": "pause"}}
  ],
  "active": true
}
```

- `edge_id`（経路 A 用）: どのエッジに配信するかのキー。経路 B では空文字のまま
- `device_id` / `service_target` は発行側の固有 ID をそのまま使用
- routes の評価順は先勝ち（最初にマッチした入力で停止）

### 実装構成

| コンポーネント | 役割 | 実装 |
|---|---|---|
| `crates/weave-server` | config + state hub、REST + WS | axum 0.7, sqlx SQLite |
| `crates/weave-engine` | MQTT routing（経路 B） | MQTT bridge + engine |
| `crates/weave-contracts` | WS protocol 型（別リポ: edge-agent 内） | serde |
| `weave-web/` | Next.js 16 UI | React 19 + Tailwind 4 |

### REST API

| エンドポイント | メソッド | 用途 |
|---|---|---|
| `/api/mappings` | GET / POST | 一覧 / 作成 |
| `/api/mappings/{id}` | GET / PUT / DELETE | 取得 / 更新 / 削除 |
| `/api/mappings/{id}/target` | POST | アクティブターゲット切替 |
| `/api/glyphs` | GET | glyph 一覧 |
| `/api/glyphs/{name}` | GET / PUT / DELETE | 取得 / upsert / 削除 |
| `/ws/edge` | WS | edge-agent 用（config push / state receive） |
| `/ws/ui` | WS | Web UI 用（snapshot + incremental UiFrame） |

mutation 系エンドポイントは成功時に:
- `push_broker` 経由で該当 edge に `ConfigPatch` / `GlyphsUpdate` を push
- `state_hub` 経由で全 UI クライアントに `MappingChanged` / `GlyphsChanged` を broadcast

## Edge Cases

| ケース | 動作 |
|---|---|
| edge-agent が weave-server に繋がらない | ローカル cache で稼働継続、再接続時に snapshot 受信 |
| weave-server 再起動 | SQLite 永続化で mapping / glyph 復元、edge-agent は自動再接続 |
| 同一入力→複数サービス | routes 配列に複数エントリを書けば順次 publish（直結経路）または MQTT fan-out（経路 B） |
| BLE 切断 | edge-agent が `device/{type}/{id}/state/connected=false` を WS で通知、再接続で自動復帰 |
| glyph 編集中 | PUT 成功 → `GlyphsUpdate` が全 edge に push、LED 表示に即時反映 |
| MQTT broker 不在（経路 B 未使用時） | weave-server は `WEAVE_DISABLE_MQTT=1` で完全無効化、直結経路のみ稼働 |

## Acceptance Criteria

1. Nuimo の rotate が Roon の volume_change として届く（< 100ms、直結経路）
2. REST で `switch_target` を呼ぶと、同じ Nuimo が別の zone を操作する
3. mapping / glyph を編集すると、edge-agent 再起動なしで挙動が変わる
4. Roon の再生状態が Web UI にライブ表示される（/ws/ui 経由）
5. edge-agent 2 台を別ホストで起動しても、各々が自分の `edge_id` の mapping だけを受信する
