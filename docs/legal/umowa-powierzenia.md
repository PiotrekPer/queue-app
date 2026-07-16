# Umowa powierzenia przetwarzania danych osobowych

**(RODO / art. 28 RODO)**

> Ten dokument jest wzorem umowy powierzenia zawieranej między **Restauracją** (Administrator)
> a **Stoliq** (Podmiot przetwarzający) w chwili rejestracji lokalu. Akceptacja następuje przez
> zaznaczenie zgody wraz z zapisaniem znacznika czasu na koncie lokalu (`venues`), zgodnie z §11
> specyfikacji. Wersja PDF (`/docs/umowa-powierzenia.pdf`) jest generowana z tego pliku.

## §1. Strony i role

1. **Administrator** — lokal gastronomiczny korzystający z Usługi (restauracja/kawiarnia), który
   decyduje o celach i sposobach przetwarzania danych osobowych gości.
2. **Podmiot przetwarzający** — **Stoliq**, który przetwarza dane osobowe **wyłącznie** w imieniu
   i na udokumentowane polecenie Administratora, w zakresie niezbędnym do świadczenia Usługi
   (wirtualna kolejka + powiadomienia SMS/e-mail).

## §2. Przedmiot i czas trwania

1. Przedmiotem jest powierzenie przetwarzania danych osobowych gości w celu prowadzenia kolejki,
   wyświetlania cyfrowego numerka oraz wysyłki maksymalnie trzech wiadomości serwisowych na wizytę.
2. Umowa obowiązuje przez czas korzystania z Usługi. Po jej zakończeniu dane są usuwane zgodnie z §7.

## §3. Rodzaj danych i kategorie osób

1. **Kategorie osób:** goście lokalu.
2. **Zakres danych (minimalizacja — §11):**
   - imię (opcjonalne),
   - numer telefonu w formacie E.164 (opcjonalny, **podawany samodzielnie przez gościa** na jego
     własnym urządzeniu),
   - adres e-mail (opcjonalny, alternatywa dla SMS),
   - znacznik zgody marketingowej (`marketing_consent_at`) — **odrębna, domyślnie niezaznaczona**.
3. **Nie przetwarzamy** danych szczególnych kategorii, dat urodzenia, adresów zamieszkania ani
   żadnych innych danych niewymienionych powyżej.

## §4. Obowiązki Podmiotu przetwarzającego

Stoliq zobowiązuje się do:

1. przetwarzania danych wyłącznie na udokumentowane polecenie Administratora;
2. zapewnienia, że osoby upoważnione do przetwarzania zobowiązały się do zachowania poufności;
3. wdrożenia środków technicznych i organizacyjnych (art. 32 RODO) — m.in. szyfrowanie w tranzycie,
   Row-Level Security w bazie, dostęp gościa wyłącznie przez tokenizowane, nieodgadywalne łącza;
4. pomocy Administratorowi w realizacji praw osób, których dane dotyczą, oraz w obowiązkach z
   art. 32–36 RODO;
5. usunięcia lub zwrotu danych po zakończeniu świadczenia Usługi (§7);
6. udostępnienia informacji niezbędnych do wykazania zgodności oraz umożliwienia audytów.

## §5. Lokalizacja i podpowierzenie (subprocesorzy)

1. Dane są przetwarzane na terenie **Unii Europejskiej**.
2. Administrator wyraża ogólną zgodę na korzystanie z następujących podprocesorów:

| Podprocesor | Rola | Region |
|---|---|---|
| **Supabase** (baza, uwierzytelnianie, funkcje brzegowe) | hosting danych aplikacji | UE — Frankfurt (eu-central-1) |
| **SMSAPI.pl** | dostawca bramki SMS | Polska |
| **Resend** | dostawca e-mail (kanał zapasowy) | UE |

3. Stoliq informuje Administratora o zamierzonych zmianach dotyczących podprocesorów, umożliwiając
   zgłoszenie sprzeciwu.

## §6. Bezpieczeństwo i naruszenia

1. Stoliq bez zbędnej zwłoki zgłasza Administratorowi każde naruszenie ochrony danych osobowych.
2. Dostęp personelu lokalu jest ograniczony do danych własnego lokalu (multi-tenant RLS, §4.2).

## §7. Retencja i usuwanie danych

1. Dane osobowe gościa są **automatycznie i trwale usuwane** po upływie okresu retencji ustawionego
   przez Administratora (**30 / 60 / 90 dni**, domyślnie 60) — zadanie `purge_guests` (§7.6).
2. Po usunięciu pozostają wyłącznie zanonimizowane rekordy wizyt/zdarzeń (bez danych osobowych),
   wykorzystywane do statystyk. Pole `visits.display_name` jest zastępowane wartością „Gość”.

## §8. Odpowiedzialność

Strony ponoszą odpowiedzialność na zasadach określonych w RODO oraz w Regulaminie Usługi.

---

_Dokument stanowi integralną część Regulaminu Stoliq. W razie sprzeczności z RODO — pierwszeństwo ma RODO._
