# ⚡ BATTLE ARENA 3D

Three.js製・ブラウザで動く「Fortnite風」3Dアクション/建築/バトルロイヤルライトゲームです。
サーバーはExpressの静的配信のみなので、GitHub → Railway の流れでそのままデプロイできます。

## 遊び方

- `WASD` : 移動
- `Space` : ジャンプ
- マウス移動 : 視点操作(クリックでポインターロック)
- 左クリック : 射撃
- 右クリック : 建築物を設置(壁 / 床 / 階段)
- `1` `2` `3` : 建築モード切替
- `R` : リロード
- `Shift` : ダッシュ
- `Esc` : マウス解除

マップに落ちている資材・弾薬を拾い、ボット(CPU)を倒しながら、縮小していく「ストーム」の中で
生き残りを目指します。最後の1人になれば勝利です。

## ローカルで動かす

```bash
npm install
npm start
```

その後 `http://localhost:3000` を開いてください。ポートは環境変数 `PORT` で変更できます。

## GitHubに公開する

```bash
git init
git add .
git commit -m "Initial commit: Battle Arena 3D"
git branch -M main
git remote add origin https://github.com/<あなたのユーザー名>/<リポジトリ名>.git
git push -u origin main
```

## Railwayにデプロイする

1. [Railway](https://railway.app/) にログインし、「New Project」→「Deploy from GitHub repo」を選択
2. 上記でpushしたリポジトリを選択
3. Railwayは `package.json` の `start` スクリプト (`node server.js`) を自動検出してビルド・起動します
4. Railwayが自動で `PORT` 環境変数を割り当てます（`server.js` は `process.env.PORT` を参照済みなので追加設定は不要です）
5. デプロイ完了後、発行されたURL(例: `https://xxxx.up.railway.app`)にアクセスすれば公開完了です

### 補足
- Node.jsのバージョンは `package.json` の `engines` で `>=18.0.0` を指定しています。RailwayはNixpacksで自動的に適切なNodeバージョンを使用します。
- 追加のビルド手順やデータベースは不要です（完全に静的ファイル + 軽量Expressサーバーのみ）。

## 技術構成

- **フロントエンド**: Three.js (r128, CDN読み込み) + Vanilla JavaScript
- **バックエンド**: Node.js + Express（`public/` の静的ファイル配信のみ）
- **ゲーム内容**:
  - 一人称視点での移動・ジャンプ・射撃
  - 壁/床/階段の建築システム(資材消費)
  - CPUボット(索敵・追跡・射撃AI)
  - 縮小するストーム(安全地帯)による生存バトルロイヤル要素
  - 弾薬・資材のフィールドピックアップ

## ディレクトリ構成

```
.
├── package.json
├── server.js         # Express静的配信サーバー
├── public/
│   ├── index.html    # UI / HUD
│   └── main.js       # ゲームロジック(Three.js)
└── README.md
```

## カスタマイズのヒント

- `public/main.js` の `WORLD_SIZE` でマップサイズを変更できます
- `spawnBots(9)` の引数でボットの数を変更できます
- `stormShrinkRate` でストームの縮小速度を調整できます
- 武器やダメージ量、建築コストなども `main.js` 内の定数から調整可能です
