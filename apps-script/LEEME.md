# Panel de redacción — Google Sheets + Drive + Apps Script

**Qué hace cada parte**

- **Sheets** guarda los datos:
  - `Hoy`: notas del día, versión del maquetador.
  - Una hoja por día (`AAAA-MM-DD`): es el archivo.
  - `Ediciones`, `Usuarios` y `Registro`.
- **Drive** guarda las fotos, en la carpeta «Altiplano al Día — Fotos». Ahí van:
  - las fotos que sube el maquetador;
  - las que cambian los editores desde el panel.
- **Apps Script** (`Code.gs`) es el servidor. Se encarga de:
  - el ingreso con usuario y clave;
  - las ediciones;
  - los usuarios;
  - recibir lo que sube el maquetador;
  - entregar las ediciones a la web.

Las ediciones cambian **solo la web**. El boletín PDF sale como lo arma el maquetador.

## Instalación (una sola vez)

1. **Crear la hoja.** En Google Drive, crea una hoja de cálculo nueva, por ejemplo «Altiplano al Día — Noticias».
2. **Cargar el código.**
   1. Abre **Extensiones → Apps Script**.
   2. Borra lo que haya y pega el contenido de `Code.gs`.
   3. En **Configuración del proyecto**, marca «Mostrar el archivo de manifiesto».
   4. Pega `appsscript.json`.
   5. Guarda.
3. **Inicializar.**
   1. Recarga la hoja. Aparece el menú **Altiplano**; elige **Inicializar (primera vez)**.
   2. Autoriza los permisos: Sheets y Drive, todo dentro de tu cuenta.
   3. Anota los tres datos que aparecen:
      - el **usuario `admin`** y su **clave inicial**;
      - la **clave API del maquetador**.
4. **Publicar el servidor.**
   1. En Apps Script, ve a **Implementar → Nueva implementación → Aplicación web**.
   2. Configura:
      - Ejecutar como: **Yo**.
      - Quién tiene acceso: **Cualquier usuario**.
   3. Copia la URL que termina en `/exec`.
5. **Conectar el sitio.**
   1. En GitHub, abre el repositorio del sitio y ve a **Settings → Secrets and variables → Actions → Variables**.
   2. Crea la variable `SHEETS_API` con la URL `/exec`.
6. **Conectar el maquetador.**
   - En `config.json`, pon `"sheets_api": "<URL /exec>"`.
   - En el `.env`, agrega `SHEETS_CLAVE=<clave API>`.

   Nunca pegues estas claves en el chat ni las subas a GitHub.

## Uso

- **Entrar:** ve a `https://altiplanoaldia.pe/admin` y entra con el usuario `admin`. Cambia la clave en **Mi clave**.
- **Crear editores:** en **Usuarios** (solo el admin) se crean editores con usuario y clave. También se les cambia la clave y se los desactiva.
- **Editar notas:** en **Notas** se elige el día y se corrige:
  - titular, antetítulo, bajada, texto y sección;
  - la foto, que se sube a Drive;
  - ocultarla de la web.
- **Cuándo se ve un cambio:** la web lo muestra en unos 15 minutos, cuando la revisión automática de GitHub recompila. También se ve antes si el maquetador publica.

## Si cambias `Code.gs`

1. Ve a **Implementar → Gestionar implementaciones**.
2. Edita la implementación y elige **Nueva versión**.

Así la URL `/exec` no cambia.

## Pruebas (sin cuenta de Google)

En `apps-script/pruebas/` hay un simulador. Ejecuta **el mismo `Code.gs`** con Sheets, Drive, caché y propiedades de Google simulados.

- **Pruebas automáticas:** `node apps-script/pruebas/pruebas.mjs` corre 39 pruebas:
  - ingreso y bloqueo por intentos;
  - roles y usuarios;
  - ediciones y restaurar;
  - fotos en Drive;
  - archivo por días;
  - protección contra fórmulas.

  GitHub las corre antes de cada publicación y, si fallan, no publica.
- **Probar todo en local:** `node apps-script/pruebas/servidor.mjs 8787 claves.json` levanta un servidor que imita al de Google. La clave del admin y la clave API quedan en `claves.json`. Después:
  - para el sitio: `VITE_SHEETS_API=http://localhost:8787 npx vite`, y entrar a `http://localhost:5180/admin`;
  - para el maquetador: usar `sheets_api` = `http://localhost:8787`.

  Al terminar, borra `public/data/ediciones*.json` y `public/img/ediciones/` si los generaste.
