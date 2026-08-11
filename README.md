# Course Certificate Generator

Fill in the fields, upload a photo, download a print-ready certificate — a single HTML file
that runs offline with no server, no build step and no network access.<br>
填欄位、上傳照片、下載可直接列印的獎狀 — 單一 HTML 檔，離線運作，不用伺服器、不用建置、完全不連網。

[English](#english) | [中文說明](#中文說明)

![The app interface](docs/screenshot-ui.png)

*The interface: form on the left, live preview on the right.*<br>
*操作畫面：左邊填資料，右邊即時預覽。*

![A generated certificate](docs/sample-output.png)

*The exported PNG — course title, name, session, hours, date, circular photo and QR code.*<br>
*匯出的 PNG — 課程名稱、姓名、屆數、時數、日期、圓形照片與 QR Code。*

---

## English

### What it is

`index.html` is a self-contained certificate generator. Everything — the certificate
background, the QR code encoder, all styling and logic — is embedded in that one file.
Download it, double-click it, and it runs straight from `file://`.

### Features

| | |
|---|---|
| **Live preview** | Every field updates the canvas as you type |
| **Course name presets** | Pick from a dropdown or type your own — the two stay in sync both ways |
| **Photo** | Click or drag-and-drop to upload; auto-cropped to a circle |
| **Photo positioning** | Drag directly on the preview to reposition, scroll to zoom |
| **QR code** | Enter a URL and it's generated and placed automatically |
| **Auto-shrinking text** | Long names and course titles scale down to fit the layout |
| **Export** | PNG at 1×–4× (default 2× = 1868 × 1324), filename includes the recipient's name |
| **Remembers your input** | Fields are saved to `localStorage` and restored next time |

### Privacy

Everything runs in your browser. Photos and text are never uploaded — the app makes no
network requests at all.

### Project structure

```
index.html               ← the built app; this is the only file you need to share
certificate.jpg          ← certificate background template (934 × 662)
src/index.src.html       ← source: markup, styling, layout coordinates, rendering
src/qrcode.js            ← source: QR code encoder
build.sh                 ← inlines certificate.jpg + qrcode.js into index.html
docs/                    ← the images above
```

Edit files in `src/`, then rebuild:

```bash
./build.sh
```

### How it works

**The background is embedded as base64, on purpose.** When a page is opened via `file://`,
drawing a locally-loaded `<img>` onto a canvas taints it, and `toBlob()` / `toDataURL()`
then throw a `SecurityError` — export would silently break for anyone who just
double-clicks the file. Inlining the JPEG as a data URI sidesteps this, and is why
`build.sh` exists.

**The QR encoder is written from scratch** (`src/qrcode.js`, ~300 lines, ISO/IEC 18004):
byte mode with UTF-8, automatic version selection across versions 1–40, Reed–Solomon error
correction over GF(256), block interleaving, and all 8 mask patterns scored by the standard
penalty rules. It has no dependencies, which is what keeps the app a single offline file.
It also upgrades the error-correction level for free whenever the chosen version has spare
capacity.

Modules are snapped to whole device pixels at the current export scale, so codes stay crisp
instead of blurring at fractional sizes.

**Verification.** Generated codes were decoded back with macOS CoreImage
(`CIDetectorTypeQRCode`) — including Chinese URLs, long query strings, and a version-17
code. The QR as actually rendered on the certificate (a 92 pt box) was tested at 2×, 3× and
4× export with 29-, 37- and 41-module codes; all decoded. The sample certificate above
still decodes after being downscaled to 1200 px for this README.

### Customizing

**Layout coordinates** live in the `LAYOUT` constant in `src/index.src.html`, expressed
against the original 934 × 662 template:

| Element | Position |
|---|---|
| Course title | centered at x 641, baseline y 204 |
| Recipient name | centered at x 622, baseline y 351 |
| Session / Hours / Date | centered at x 789, baselines y 441 / 521 / 601 |
| Photo circle | center (330, 521), radius 121 |
| QR code | center (66, 593), 92 pt box |

The photo circle values are measured from the template — its white circle is centered at
(330, 521) with a radius of 120.5, so the default radius of 121 covers it fully with no
white sliver showing. The size slider is floored at 121 for the same reason.

**Course name presets** are the `<option>` entries under `#fTitlePreset`. The current set:

- 彼得潘的 iOS SwiftUI App 程式設計入門
- 文組生的 iOS SwiftUI App 程式設計入門
- 彼得潘的 Flutter 跨平台 App 程式設計入門

**Using a different background:** replace `certificate.jpg`, adjust `LAYOUT`, and run
`./build.sh`.

### Note on the template

`certificate.jpg` is the artwork for a specific course. If you're adapting this for your own
use, swap in your own background.

[⬆ Back to top](#course-certificate-generator)

---

## 中文說明

### 這是什麼

`index.html` 是一個自給自足的獎狀產生器。獎狀底圖、QR Code 產生器、所有樣式與邏輯，全部
內嵌在這一個檔案裡。下載、雙擊打開，直接用 `file://` 就能跑。

### 功能

| | |
|---|---|
| **即時預覽** | 每個欄位一邊打字一邊更新畫面 |
| **課程名稱下拉選單** | 可從清單選擇或自行輸入，兩者雙向同步 |
| **照片上傳** | 點選或拖曳上傳，自動裁成圓形 |
| **照片位置調整** | 直接在預覽圖上拖曳移位，滾輪縮放 |
| **QR Code** | 輸入網址即自動產生並放到定位 |
| **文字自動縮放** | 過長的姓名與課程名稱會自動縮小以符合版面 |
| **匯出** | 1×～4× PNG（預設 2× = 1868 × 1324），檔名自動帶上學員姓名 |
| **記住輸入內容** | 欄位存進 `localStorage`，下次開啟自動帶入 |

### 隱私

所有處理都在你的瀏覽器內完成。照片與文字不會被上傳 — 這個 App 完全不發出任何網路請求。

### 專案結構

```
index.html               ← 建置後的成品，要分享只需要給這一個檔
certificate.jpg          ← 獎狀底圖範本（934 × 662）
src/index.src.html       ← 原始碼：畫面、樣式、版面座標、繪圖邏輯
src/qrcode.js            ← 原始碼：QR Code 產生器
build.sh                 ← 把 certificate.jpg 與 qrcode.js 內嵌進 index.html
docs/                    ← 上方的圖片
```

改完 `src/` 底下的檔案後，重新建置：

```bash
./build.sh
```

### 實作說明

**底圖刻意內嵌成 base64。** 當網頁以 `file://` 開啟時，把本機載入的 `<img>` 畫進 canvas 會使其
被「污染」（tainted），接著呼叫 `toBlob()` / `toDataURL()` 就會丟出 `SecurityError` — 也就是說，
只要使用者是雙擊開檔，匯出功能就會壞掉。把 JPEG 內嵌成 data URI 可以繞過這個限制，這也是
`build.sh` 存在的理由。

**QR Code 產生器是自己實作的**（`src/qrcode.js`，約 300 行，依 ISO/IEC 18004）：byte mode 搭配
UTF-8、版本 1～40 自動選版、GF(256) 上的 Reed–Solomon 錯誤更正、區塊交錯，以及依標準懲罰規則
評分的 8 種遮罩圖樣。沒有任何依賴，這正是這個 App 能維持成單一離線檔案的原因。另外，當選定
版本還有剩餘空間時，它會自動免費提升容錯等級。

模組會依當前輸出倍率對齊到整數實體像素，因此在非整數尺寸下也不會糊掉。

**驗證。** 產生的 QR Code 用 macOS CoreImage（`CIDetectorTypeQRCode`）反解回來驗證過 — 包含
中文網址、長查詢字串，以及一個 v17 大型碼。實際畫在獎狀上（92 pt 方框）的 QR，也在 2×、3×、
4× 輸出下分別以 29、37、41 模組測試，全部可正常解讀。上方那張範例獎狀縮到 1200 px 後，QR
依然掃得出來。

### 自訂

**版面座標**放在 `src/index.src.html` 的 `LAYOUT` 常數，以原始 934 × 662 底圖為基準：

| 元素 | 位置 |
|---|---|
| 課程名稱 | 置中於 x 641，基線 y 204 |
| 學員姓名 | 置中於 x 622，基線 y 351 |
| 屆數 / 時數 / 日期 | 置中於 x 789，基線 y 441 / 521 / 601 |
| 照片圓框 | 中心 (330, 521)，半徑 121 |
| QR Code | 中心 (66, 593)，92 pt 方框 |

照片圓框的數值是從底圖實際量出來的 — 底圖白圓的中心在 (330, 521)、半徑 120.5，所以預設半徑
取 121 剛好完全蓋住，不會露出白邊。大小滑桿的下限同樣鎖在 121。

**課程名稱選項**是 `#fTitlePreset` 底下的 `<option>`。目前的清單：

- 彼得潘的 iOS SwiftUI App 程式設計入門
- 文組生的 iOS SwiftUI App 程式設計入門
- 彼得潘的 Flutter 跨平台 App 程式設計入門

**要換底圖：** 替換 `certificate.jpg`、調整 `LAYOUT`，然後執行 `./build.sh`。

### 關於底圖

`certificate.jpg` 是特定課程的美術素材。如果你要改作自用，請換成自己的底圖。

[⬆ 回到最上方](#course-certificate-generator)
