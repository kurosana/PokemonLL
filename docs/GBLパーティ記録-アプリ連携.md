# GBLパーティ記録をサイトへ送る

専用アプリ（まずは iPhone。あとから Android でも同じ口を使う）が、ポケモンGOで終わった対戦を PokemonLL に1件ずつ渡すときの取り決めです。サイト側の受け口はできています。アプリ側の送信は、まだ何も入っていません。

## 送る場所

```
POST https://pokemon-ll.tsutayuki.workers.dev/api/gbl-matches
Content-Type: application/json
```

開発中のサイトでもパスは同じです。`/api/gbl-matches`

この反映が本番に入るまでは、本番URLはまだこの口を持っていません。

ブラウザ以外からの送信なので、iOS の URLSession も Android の HTTP クライアントも、CORS は気にしなくて大丈夫です。ブラウザから試すとき用に、`OPTIONS` と `Access-Control-Allow-Origin: *` は返します。

認証ヘッダは今は要りません。誰でも1件追加できます。公開前に合言葉を足す場合は、そのときアプリとサイトを一緒に直します。

## 1件の中身

プレイヤー名、自分3体、相手3体、勝ち負け、リーグ。この5つだけです。

```json
{
  "player": "dummy",
  "league": "great",
  "result": "win",
  "self": [
    { "id": 376, "name": "メタグロス" },
    { "id": 149, "name": "カイリュー" },
    { "id": 184, "name": "マリルリ" }
  ],
  "opponent": [
    { "id": 379, "name": "レジスチル" },
    { "id": 3, "name": "フシギバナ" },
    { "id": 445, "name": "ガブリアス" }
  ],
  "clientId": "任意の再送防止ID"
}
```

| フィールド | 内容 |
| --- | --- |
| `player` | 表示するプレイヤー名。前後の空白は捨てる。1〜24文字。改行は不可 |
| `league` | `little` リトル、`great` スーパー、`ultra` ハイパー、`master` マスター。日本語の `リトル` `スーパー` `ハイパー` `マスター` と、それぞれの「〜リーグ」も受け取れる |
| `result` | `win` または `loss`。`勝ち` `勝` `負け` `負` も受け取れる |
| `self` | 自分のポケモン。必ず3体、この順が並びの左から |
| `opponent` | 相手のポケモン。必ず3体 |
| `id` | 全国図鑑番号。1〜2000の整数。絵はこの番号で出す |
| `name` | 画面に出す名前。1〜24文字 |
| `form` | 省略時は `Normal`。リージョンやメガなど、サイトのフォルム名を入れる。32文字まで |
| `clientId` | 省略可。英数字と `_:.-` で80文字まで。同じプレイヤーで同じ値を再送しても、記録は増えない |

成功すると `201` で、保存した1件が `match` に入って返ります。同じ `clientId` の再送は `200` で、既にある1件を返します。`created` が `false` です。

失敗は `400` で `{ "error": "理由" }` です。通信が途中で切れたときは、同じ `clientId` で送り直してください。

## 保存のされ方

サイトは受け取った配列を、新しいものが先になるように溜めます。上限は2000件で、古いものから落ちます。

本番で残すには、Cloudflare の KV を `GBL_MATCHES` という名前で Worker に結んでください。中身のキーは `matches` です。結びが無いあいだは、その Worker が生きているあいだだけのメモリに入り、再起動でダミーの5件に戻ります。ローカルの開発サーバは `work/gbl-matches.json` に書きます。

## iPhone（URLSession）

`self` は Swift の予約語なので、プロパティ名は別にします。

```swift
struct GblMon: Codable {
    let id: Int
    let name: String
    var form: String? = nil
}

struct GblMatchBody: Codable {
    let player: String
    let league: String
    let result: String
    let selfTeam: [GblMon]
    let opponent: [GblMon]
    let clientId: String

    enum CodingKeys: String, CodingKey {
        case player, league, result, opponent, clientId
        case selfTeam = "self"
    }
}

func sendMatch(_ body: GblMatchBody) async throws {
    var request = URLRequest(url: URL(string: "https://pokemon-ll.tsutayuki.workers.dev/api/gbl-matches")!)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try JSONEncoder().encode(body)
    let (data, response) = try await URLSession.shared.data(for: request)
    guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
        throw URLError(.badServerResponse)
    }
    _ = data
}
```

リーグはアプリ内では `little` / `great` / `ultra` / `master` に揃えて送ると、あとから読みやすいです。対戦が終わったタイミングで1件送り、失敗したら同じ `clientId`（その対戦のUUID）でリトライします。

## Android（あとから）

同じJSONを、同じURLへ `POST` します。Kotlin では `self` が予約語ではないので、そのままフィールド名にできます。OkHttp でも `HttpURLConnection` でも構いません。`Content-Type: application/json`、成功は 200 か 201、再送は同じ `clientId` です。

## 消すとき

プレイヤー名の削除は管理者画面だけが使います。アプリからは呼びません。

```
DELETE /api/gbl-matches
Content-Type: application/json

{ "player": "dummy", "password": "管理者の合言葉" }
```

そのプレイヤーの記録が全部消えます。パスワードが違うと `401`、名前が無いと `404` です。
