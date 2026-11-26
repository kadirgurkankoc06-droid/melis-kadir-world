MELIS & KADIR WORLD

GitHub Pages'e yükleme:
1. ZIP dosyasını bilgisayarında çıkar.
2. İçindeki index.html, game.html, kafa-topu.html, README.txt, robots.txt, melis-avatar.png ve kadir-avatar.png dosyalarını GitHub deposunun ana dizinine yükle.
3. Aynı adlı dosyalar sorulursa üzerine yazmayı seç.
4. Commit changes ile kaydet.
5. Yayın adresini açıp Ctrl+F5 yap.

Ortak anılar / Supabase:
- Dünya haritası, gezilen yerler, istek listesi, il işaretleri ve fotoğraflar Supabase üzerinden ortak tutulur.
- Herkes siteyi giriş yapmadan görüntüleyebilir.
- Yer ve fotoğraf ekleme/düzenleme için yalnızca Supabase'de oluşturulmuş Kadir hesabıyla giriş yapılır.
- Sitedeki Giriş yap düğmesine basıp Supabase Auth kullanıcısının e-posta ve şifresini gir.
- Tarayıcıya yalnızca Supabase publishable anahtarı eklenmiştir. Secret/service_role anahtarını GitHub'a veya site dosyalarına koyma.
- Storage bucket: world-photos (public read, yalnızca Kadir kullanıcısına upload).
- Database table: public.world_data (id=1, data JSONB).

Not: İlk kez Kadir hesabıyla giriş yapıldığında bu bilgisayarda localStorage'da bulunan eski konumlar ortak veritabanına aktarılır. Fotoğraflar Storage'a yüklenir.

Kafa Topu: kafa-topu.html dosyası. Oyun içinde Telefon ve PC modları seçilebilir. Melis karakteri mor renktedir.
