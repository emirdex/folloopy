UPDATE blog_posts SET body=replace(body, '## Mevcut çalışma ortamını bilin

Yerel geliştirme sürümü sentetik test sağlayıcısıyla çalışır. Gerçek Gmail bağlantısı ve tarayıcı eklentisi doğrulanmadan gerçek alıcıya gönderim yapılmaz. Paneldeki test akışı, bu temel davranışları denemeniz içindir.', '## Hesap bağlantınızı kontrol edin

E-posta hesabınızın bağlantı durumunu Bağlı hesaplar bölümünden kontrol edin. Gönderim özelliklerinin kullanılabilirliği, sağlayıcı bağlantısının durumuna bağlıdır.'), updated_at=now() WHERE slug='gonderim-gozlem-ve-kontrol' AND strpos(body, '## Mevcut çalışma ortamını bilin

Yerel geliştirme sürümü sentetik test sağlayıcısıyla çalışır. Gerçek Gmail bağlantısı ve tarayıcı eklentisi doğrulanmadan gerçek alıcıya gönderim yapılmaz. Paneldeki test akışı, bu temel davranışları denemeniz içindir.')>0;
UPDATE workspaces SET name='Folloopy çalışma alanı' WHERE name='Yerel test çalışma alanı';
