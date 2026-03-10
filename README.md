# Trading Cards 導入

このREADMEは、現在の `tradingcards` リソースを **壊さず導入・再導入するための実運用向けメモ** です。  
大きく作り直す前提ではなく、**今動いている構成をそのまま使う** 方針でまとめています。

# このリソースについて

このリソースは、FiveM / QBCore 環境向けのトレーディングカードシステムです。  
カードパックの使用、開封演出、カードコレクション管理、Finder画面での絞り込み表示などを行えます。

導入するとできること:

- カードパックの開封
- 所持カードのコレクション表示
- カードのトレード
- カードのプレビュー表示
- レアリティ / 所持状態でのフィルタ表示
- [管理者] カードパック、カードファインダーの生成
- [管理者] カードの登録＆編集
- [管理者] レアリティ別の抽出率の変更

  <img width="1286" height="960" alt="image" src="https://github.com/user-attachments/assets/97e2f35c-1167-4012-a1e7-ba5201728e5a" />

---

## 1. 前提

想定環境:
- FiveM
- QBCore ベース
- oxmysql 利用環境
- NUI が有効な通常のクライアント環境

このリソースは、主に以下で構成されています。
- サーバー側 Lua
- クライアント側 Lua
- `html/` 以下の NUI 一式
- カードパック、背面画像
- 効果音
- 必要に応じた DB テーブル
- 使用用アイテム（カードパック、カードファインダー）

---

## 2. 導入の流れ

基本の流れはこれです。

1. リソースを `resources` 配下に配置  
2. `server.cfg` に `ensure tradingcards` を追加  
3. 使用アイテム（カードパック）を登録
4. 管理者の登録
5. カード画像や音声ファイルの配置確認  
6. 管理者権限で `/cardadmin` が使えるか確認  
7. 実際にパックを配布して開封テスト

---

## 3. リソース配置
tradingcardsのフォルダを例のように配置してください。  
resources内であればどのディレクトリでも問題ありません。  
  
例:

```text
resources/[local]/tradingcards
```

`server.cfg` 側で起動設定を追加します。

```cfg
ensure tradingcards
```

依存関係がある場合は、`qb-core` や `oxmysql` の後に読み込まれるようにしてください。

例:

```cfg
ensure oxmysql
ensure qb-core
ensure tradingcards
```

---

## 4. アイテム登録

カードパック、カードファインダーをアイテムとして、`ox_inventory\data\items.lua` 等に登録が必要です。

例:

```lua
        ['cardpack'] = {
               label = 'カードパック',
               weight = 10,
               stack = true,
               close = true,
               consume = 0,
               client = { 
                        export = 'tradingcards.usePackClient',
                        image = 'cardpack.png'    
               }
        },

        ['cardfinder'] = {
              label = 'カードファインダー',
              weight = 10,
              stack = true,
              close = true,
              consume = 0,
              client = { 
                       export = 'tradingcards.openBinderClient',
                       image = 'cardfinder.png'      
            }
        },
```

実際のアイテム名は、リソース内の `UseItem` や `CreateUseableItem` で使っている名前に合わせてください。  
ここがズレると、**アイテムはあるのに開封できない** 状態になります。

---

## 5. 管理者コマンド `/cardadmin`

管理者用コマンドがあるため、権限設定が必要です。  

- `server.cfg` で ACE 権限を付与

ACE 権限の例:

```cfg
add_ace group.admin cardadmin allow
add_principal identifier.license:xxxxxxxxxxxxxxxxxxxxxxxxxxxx group.admin
```

---

## 6. 画像の配置

インベントリ画像（inv_items配下）は、リソース内で参照しているパスに置く必要があります。  
ox_inventoryの場合、このディレクトリ構成が多いです。

```text
\ox_inventory\web\images
```

**今動いている版の配置場所をそのまま維持** するのが安全です。  
フォルダ整理のために無理に移動すると、参照パスが壊れやすいです。

---

## 7. NUI（html）を触るときの注意

今の構成は、演出・ボタン配置・音の順番などをかなり細かく詰めてあります。  
そのため、以下は**大きく触らないほうが安全**です。

- `html/index.html` の構造大変更
- `html/app.js` の関数名変更
- `html/style.css` の大規模整理
- フォルダ再編

おすすめの方針:
- 必要な箇所だけ差分修正
- 動いているファイル名は変えない
- UI整理のためだけのリファクタはしない

---

## 8. 動作確認チェック

最低限この順で確認すると安全です。

### サーバー起動時
- エラーが出ていない
- SQLエラーがない
- resource が正常に started している

### ゲーム内
- パックアイテムが配布できる
- パックを使用できる
- 開封画面が開く
- 開封音が鳴る
- 回転演出が動く
- レアリティ音が想定タイミングで鳴る
- Finder にカードが反映される
- フィルタ（ALL / R / SR / SSR / UR / Owned）が動く
- Trade / Close が正常動作する

  ※ 初期は一枚もカードが登録されていないため、初めに登録する必要があります。

---

以上。
