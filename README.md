# Barra Libre

Gestión de eventos de barra libre (open bar): registro de consumo de bebidas,
cálculo de costes y generación del Excel de resultados (P&L) a partir de la
plantilla oficial `P&L Eventos TEMPLATE.xlsm`.

## Vistas

- **Supervisor** (`/`): datos del evento, líneas de consumo, envío del parte
  por Telegram al grupo del evento.
- **Manager** (`/#/manager?d=...`): se abre desde el botón inline de Telegram,
  llega precargada con el payload de la URL y completa los datos económicos
  (ingresos, otros costes) para generar y descargar el Excel.

Las credenciales de Telegram se inyectan en build mediante variables de
entorno `VITE_TELEGRAM_BOT_TOKEN` y `VITE_TELEGRAM_CHAT_ID`.

## La plantilla Excel

La app carga la plantilla como texto base64 (`barra-libre-template.b64`) para
poder servirse en GitHub Pages. Ese `.b64` **no se guarda en el repositorio**:
se genera a partir del binario `public/barra-libre-template.xlsm`:

- En local: `scripts/gen-assets.mjs` (automático antes de `npm run dev` y
  `npm run build`).
- En CI: el workflow ejecuta `base64 -w0` antes del build.

## Los componentes UI (shadcn)

`src/components/ui` y `src/hooks` **no se guardan en el repositorio**: son
componentes estándar de shadcn que se regeneran con su CLI (la
configuración vive en `components.json`). El workflow lo hace automáticamente
en cada build. Si personalizas alguno, bórralo de `.gitignore` y comítelo.

## Puesta en marcha local

```bash
npm install
npx shadcn@latest add button dialog input label separator sheet skeleton textarea toggle tooltip -y -o
# coloca la plantilla en public/barra-libre-template.xlsm
npm run dev
```

## Despliegue en GitHub Pages

La primera vez hay que completar cuatro pasos (luego cada `push` a `main`
despliega solo):

### 1. Subir la plantilla Excel al repositorio

En GitHub: **Add file → Upload files**, arrastra la plantilla y pon como
nombre de ruta `public/barra-libre-template.xlsm`, y confirma el commit.

### 2. Crear el workflow de despliegue

En GitHub: **Add file → Create new file** y pon como nombre de ruta
`.github/workflows/deploy.yml`. Contenido:

```yaml
name: Desplegar en GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Generar componentes UI (shadcn)
        run: npx shadcn@latest add button dialog input label separator sheet skeleton textarea toggle tooltip -y -o
      - name: Generar plantilla base64
        run: base64 -w 0 "public/barra-libre-template.xlsm" > public/barra-libre-template.b64
      - name: Instalar dependencias
        run: npm install
      - name: Build
        run: npm run build
        env:
          VITE_TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          VITE_TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

> La lista contiene exactamente los componentes que la app usa. Si añades
> nuevas importaciones de `src/components/ui`, agrégalos a ese `add` (y a la
> sección de puesta en marcha local).

### 3. Activar GitHub Pages

En **Settings → Pages**, en *Source* elige **GitHub Actions**.

### 4. Crear los secrets de Telegram

En **Settings → Secrets and variables → Actions → New repository secret**, crea:

- `TELEGRAM_BOT_TOKEN` — token del bot (ej. `123456:ABC...`).
- `TELEGRAM_CHAT_ID` — id del chat/grupo (ej. `-1004294178574`).

Hecho esto, cualquier push a `main` (o el botón *Run workflow*) publica la
app en `https://saleevastudio-lab.github.io/barra-libre/`.

> Nota: el token del bot viaja al bundle que se sirve al navegador. Es la
> opción práctica para esta app, pero si alguna vez sospechas que se filtró,
> revócalo y genera uno nuevo con @BotFather.

## Actualizar la plantilla o el catálogo de bebidas

- **Plantilla**: reemplaza `public/barra-libre-template.xlsm` (Upload files
  en GitHub) y haz push; el workflow regenera el `.b64` en cada build.
- **Bebidas**: editables desde la propia app (vista supervisor) y persistidas
  en `localStorage`.
