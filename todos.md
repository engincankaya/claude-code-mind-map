nceledim. Birkaç gerçek hata + birkaç iyileştirme gerekiyor:

🔴 Kritik (işlevsel bug'lar)
Tüm agent frontmatter'larında MCP tool isimleri yanlış
mindmap-agent.md:5-7, architect-agent.md:5-7, impact-agent.md:5, onboard-agent.md:5

Şöyle yazılmış: mcp__mindmap__discover, mcp__mindmap__inspect, mcp__mindmap__generate
Gerçek tool isimleri: mcp__mindmap__mindmap_discover, mcp__mindmap__mindmap_inspect, mcp__mindmap__mindmap_generate, mcp__mindmap__mindmap_overview

Bu haliyle agent'lar tool'ları çağıramaz — isim eşleşmesi yanlış. Bu hatayı az önce bizzat gördük: ilk Agent çağrılarım 0 tool_uses döndü.

mindmap.overview tool'u hiçbir yerde yok
Gerçek MCP server'da mevcut ama README.md, mindmap-rules/SKILL.md, agent frontmatter'ları hiç bahsetmiyor. En azından mindmap-agent.md ve architect-agent.md tools listelerine eklenmeli.

commands/generate.md:1 typo + stray yorum
//midmap-agent çalıştırılmalı — "midmap" yazım hatası, hem de // geçersiz markdown/slash-command syntax'ı. Ya silinmeli ya da "Delegate to the mindmap-agent subagent." şeklinde düzgün bir talimata çevrilmeli.

🟡 Tasarım sorunu
"Sadece highlight dosyaları için açıklama" kuralı çok sıkı commands/generate.md:9 ve mindmap-agent.md:37 şunu diyor: "only write detailed file descriptions for those highlighted files". Sonuç: mindmap-output.json'da 50 dosyanın 40'ı tek kelimelik etiketle kalıyor (senin de az önce şikayet ettiğin konu). Öneri: kural şöyle güncellensin:
"Write a one-line role description for every file. Write a 2-3 sentence detailed description only for highlighted files."

🟠 Küçük iyileştirmeler
Artifact ID karmaşası hiçbir yerde uyarı olarak yok
Bizzat inspectionArtifactId yerine parseArtifactId geçirip hata aldım. mindmap-rules/SKILL.md "Artifact Store Flow" bölümüne şunu eklemek iyi olur:

"inspect dış bir artifactId (inspectionResult) döndürür, bir de iç parseArtifactId. Diğer tool'lara daima dış artifactId'yi geçirin."

mindmap-agent.md:28 "mode="detailed""
Küçük dil hatası: depth="detailed" kastediliyor, mode="detailed" değil. Şöyle düzelt: "Optionally call mindmap.inspect with mode=\"parse\" and depth=\"detailed\" for critical files…".

impact.md ve explain.md edge'lere dayanıyor
impact.md:6-7, explain.md:9-11 "1-hop/2-hop dependents" diyor, ama hierarchical parsing standard depth'te durursa mindmap-output.json'da 0 edge oluyor (bizimkinde de 0). Bu komutlar sessizce bozuluyor. /mindmap:generate kuralına "run detailed depth across all source files if edge-based tooling is desired" notu eklenmeli — ya da en azından impact.md baş kısmına "requires mind map with edges" uyarısı.

İstersen 1-4'ü (kritik + tasarım) hemen düzelteyim — dört dosyada küçük edit'ler. 5-7'yi ayrı bir PR gibi sonraya bırakabilirsin. Onay verir misin?