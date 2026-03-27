# Logeaftener – version 2 med database

Denne pakke er lavet til at kunne lægges på GitHub og bruges sammen med **GitHub Pages** + **Supabase**.

## Hvad du får

Denne udgave er lavet med **navn-login**: man vælger sit navn i en dropdown og skriver sin adgangskode.

- `index.html` – selve siden
- `style.css` – layout og design
- `app.js` – logik og forbindelse til database
- `supabase-config.js` – her indsætter du din Supabase URL og anon key
- `database/schema.sql` – opretter tabeller og adgangsregler
- `database/seed.sql` – indsætter medlemmer og eksempelaftener

## Vigtigt at vide

Denne version virker **ikke** bare ved upload alene.
Du skal gøre 3 ting først:

1. Oprette et Supabase-projekt
2. Køre SQL-filerne
3. Udfylde `supabase-config.js`

Når det er gjort, kan du uploade filerne til GitHub og bruge GitHub Pages.

---

## Trin 1 – opret Supabase

1. Opret en konto hos Supabase
2. Opret et nyt projekt
3. Når projektet er klar, find:
   - **Project URL**
   - **Anon public key**

Du finder dem normalt under projektets API-indstillinger.

---

## Trin 2 – kør SQL

1. Gå til **SQL Editor** i Supabase
2. Kopiér hele indholdet fra `database/schema.sql`
3. Kør det
4. Kopiér derefter hele indholdet fra `database/seed.sql`
5. Kør det

### Vigtigt før du kører `seed.sql`
Ret gerne e-mailen på **Lars Møller Andersen** til din rigtige e-mailadresse.

Eksempel i `seed.sql`:

```sql
('Lars Møller Andersen', 'lars@example.dk', '', '35', true, false, 'admin')
```

Skift `lars@example.dk` til din rigtige mail.

---

## Trin 3 – opret login-bruger i Supabase Auth

1. Gå til **Authentication** i Supabase
2. Opret en bruger manuelt
3. Brug **samme e-mailadresse** som i `members`-tabellen
4. Vælg en adgangskode

Hvis e-mailen i Auth og e-mailen i `members` ikke matcher, virker login ikke.

Selve brugeren vælger sit **navn** på login-skærmen, men systemet bruger den tilknyttede e-mail i baggrunden til at logge ind sikkert via Supabase.

---

## Trin 4 – udfyld `supabase-config.js`

Åbn filen `supabase-config.js` og indsæt dine værdier.

Eksempel:

```js
export const SUPABASE_URL = 'https://abcd1234.supabase.co';
export const SUPABASE_ANON_KEY = 'din_anon_key_her';
```

---

## Trin 5 – upload til GitHub

Upload disse filer til et nyt repository:

- `index.html`
- `style.css`
- `app.js`
- `supabase-config.js`
- `.nojekyll`

Du kan også gerne lægge `README.md` og `database`-mappen med.

---

## Trin 6 – slå GitHub Pages til

På GitHub:

1. Gå til **Settings**
2. Gå til **Pages**
3. Vælg:
   - **Deploy from branch**
   - branch: `main`
   - folder: `/root`
4. Gem

Derefter får du en webadresse.

---

## Sådan virker systemet

### For brødre
- logger ind ved at vælge navn og skrive adgangskode
- ser kommende logeaftener
- kan melde fra inden fristen
- kan melde sig til, hvis de er i gruppen med aktiv tilmelding

### For admin
- kan oprette logeaftener
- kan redigere medlemmer
- kan ændre roller
- kan justere påmindelsesindstillinger
- kan ændre deltagerstatus

---

## Det vigtigste først
Hvis du vil have det op at køre hurtigt, så gør kun dette:

1. ret din e-mail i `seed.sql`
2. kør `schema.sql`
3. kør `seed.sql`
4. opret din bruger i Supabase Auth
5. udfyld `supabase-config.js`
6. upload til GitHub
7. aktivér GitHub Pages

---

## Bemærkninger

- Mailpåmindelser bliver kun **gemt som indstilling** endnu
- Systemet sender ikke rigtige mails eller SMS automatisk endnu
- Deadline håndhæves i appen
- Adgangsreglerne er sat op, så admin har mere kontrol end almindelige brugere

---

## God næste forbedring
Når denne version virker, vil næste naturlige skridt være:

- rigtig mailpåmindelse
- mulighed for nulstilling af adgangskode
- bedre adminoversigt
- eksport til Excel eller PDF
