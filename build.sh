#!/bin/bash
# 由 src/ 產生單一檔案 index.html（底圖與 QR 產生器都內嵌，可直接雙擊離線使用）
set -e
cd "$(dirname "$0")"

python3 - <<'PY'
import base64

src = open('src/index.src.html', encoding='utf-8').read()
qr  = open('src/qrcode.js', encoding='utf-8').read()
b64 = base64.b64encode(open('certificate.jpg', 'rb').read()).decode()

src = src.replace('<script src="__QRCODE_JS__"></script>', '<script>\n' + qr + '\n</script>')
src = src.replace('__TEMPLATE_DATA_URI__', 'data:image/jpeg;base64,' + b64)

open('index.html', 'w', encoding='utf-8').write(src)
print('index.html 已產生（%.1f KB）' % (len(src.encode('utf-8')) / 1024))
PY
