# Chappie

ハンズフリー音声AIアシスタント。ウェイクワード「**chappie**」で起動し、声だけでOpenAIと会話できる、トレイ常駐のElectronアプリ。

## できること（MVP）

- ウェイクワード `chappie` でAIを呼び出し、声で質問・会話する
- 返答は音声で読み上げ（OS標準のWeb Speech APIボイス）
- 会話の文脈はアプリ起動中だけ保持、終了でリセット
- メニューバー / タスクトレイのアイコンが状態を表示（待機 / 聞いてる / 考え中 / 喋ってる / エラー）

## 動作要件

- macOS（優先サポート）または Windows
- マイク（PC内蔵で十分）
- OpenAI API キー

## 開発

```bash
pnpm install
pnpm dev
```

トレイのアイコンを右クリック → **設定…** から OpenAI API キーを登録してください。

## 配布ビルド

```bash
pnpm build              # 共通の事前ビルド
pnpm build:mac          # macOS .dmg
pnpm build:win          # Windows .exe
```

成果物は `release/<version>/` に出力されます。

## ドキュメント

- 設計書: [`docs/superpowers/specs/2026-05-06-chappie-design.md`](docs/superpowers/specs/2026-05-06-chappie-design.md)
- 実装プラン: [`docs/superpowers/plans/2026-05-06-chappie-mvp.md`](docs/superpowers/plans/2026-05-06-chappie-mvp.md)

## ライセンス

MIT
