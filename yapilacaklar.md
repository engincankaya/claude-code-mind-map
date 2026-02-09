# Yapilacaklar

## 1. Backend Server Olustur (Express)
Frontend'den gelen HTTP isteklerini alip `claude -p` komutunu child_process ile calistiran basit bir Express server. SSE (Server-Sent Events) ile streaming destegi. Port 3001, frontend'i static olarak servis etsin.

## 2. Frontend'e "Ask Claude" Butonu Ekle
File node'una tiklandiginda acilan detail card'a bir "Ask Claude" butonu koy. Butona basildiginda backend'e POST /api/explain istegi gondersin. Node bilgileri (path, role, group, edges) body'de gitsin.

## 3. Streaming Yaniti Detail Card'da Goster
Backend'den gelen SSE stream'ini oku, token token detail card'in icine yaz. Yanit gelirken "thinking..." animasyonu goster, bittiginde kaldır. Markdown rendering'e gerek yok, duz text yeterli.

## 4. claude -p Prompt Sablonu Hazirla
/explain komutunun mantığini backend prompt'una tasi. mindmap-output.json'u okumasini, node'un role/group/dependencies bilgilerini analiz etmesini soyleyen iyi bir prompt yaz. `--allowedTools "Read,Glob,Grep"` ile calistir.

## 5. Frontend Bug'larini Test Et
Collapsible gruplar, detail card acilma/kapanma, edge cizimleri, highlight — hepsini tarayicida test et. `python3 -m http.server 8080` ile calistirip mindmap-output.json'un yuklenmesini dogrula.

## 6. Session Resume Destegi
claude -p'nin `--output-format json` ile dondurdugu session_id'yi sakla. Ayni node icin tekrar soru sorulursa `--resume <session_id>` ile onceki context'e devam et. Boylece Claude onceki analizi hatirlayarak daha derin cevap verir.

## 7. Impact Analizi Icin Endpoint
POST /api/impact endpoint'i ekle. Tiklanilan node icin `claude -p` ile /impact mantığını calistir. Blast radius, risk seviyesi, etkilenen dosyalar — hepsini detail card'da goster.
