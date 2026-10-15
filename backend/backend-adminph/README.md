# AdminPH Backend — V0.5

Backend inicial para conectar el frontend existente de AdminPH con PostgreSQL.

## Reglas de votación implementadas

- **Una unidad privada emite una sola papeleta por cada actividad/sesión de votación.**
- Una actividad puede tener 4 candidatos y declarar 3 ganadores, pero cada unidad escoge **un solo candidato** en esa actividad.
- `winners_required` define cuántos ganadores deben quedar visados al cerrar la actividad.
- Los ganadores se confirman mediante checklist auditable (`is_winner`).
- La regla de conteo puede ser `nominal` o `coefficient`:
  - `nominal`: cada papeleta cuenta 1.
  - `coefficient`: sigue existiendo una sola papeleta por unidad, pero el resultado ponderado suma el coeficiente de la unidad.
- El sistema conserva siempre **quién votó qué**.
- `include_voter_details_in_minutes` decide si el PDF/acta incluye el listado nominal de votantes por opción.
- El QR pertenece a **una unidad dentro de una asamblea**, no a una votación.
- El mismo QR sirve para todas las votaciones abiertas de esa asamblea.
- El QR se genera al marcar la unidad como presente y se revoca si vuelve a ausente.
- Un operador solo lista QR activos de unidades presentes.
- El coeficiente se toma de PostgreSQL (`units.total_coefficient`), nunca del navegador.

## Migraciones

### Si NO ejecutaste la V2 anterior

Ejecuta solamente:

1. `DATABASE_SCHEMA_V1.sql`
2. `sql/DATABASE_SCHEMA_V2_BACKEND.sql`

### Si YA ejecutaste la V2 anterior entregada en V0.1

Ejecuta:

- `sql/DATABASE_SCHEMA_V3_SINGLE_BALLOT_WINNERS.sql`

La V3 restaura la regla de una sola papeleta por unidad y agrega el checklist de ganadores.

## Requisitos locales

1. PostgreSQL funcionando.
2. Node.js 20+ (recomendado Node.js 22 LTS).
3. Una base de datos, por ejemplo `adminph`.

## Configuración

Copiar `.env.example` a `.env` y editar:

```env
DATABASE_URL=postgresql://postgres:TU_CLAVE@localhost:5432/adminph
JWT_SECRET=...
QR_SIGNING_SECRET=...
PUBLIC_APP_URL=http://127.0.0.1:5500
CORS_ORIGINS=http://127.0.0.1:5500,http://localhost:5500
```

## Ejecutar

```bash
npm install
npm run build
npm run start:dev
```

Verificar:

- API: `http://localhost:3000/api/health`
- Swagger: `http://localhost:3000/api/docs`

## Flujo de una elección con varios ganadores

Ejemplo: 4 candidatos, 3 cargos.

1. Crear sesión con `winnersRequired: 3`.
2. Cada unidad presente emite **un solo voto** por uno de los 4 candidatos.
3. Cerrar la votación.
4. Revisar resultados.
5. Marcar exactamente 3 candidatos ganadores mediante:

```http
PUT /api/voting-sessions/:sessionId/winners
Authorization: Bearer <token>
Content-Type: application/json

{
  "optionIds": ["uuid-candidato-1", "uuid-candidato-2", "uuid-candidato-3"]
}
```

El acta puede mostrar los tres candidatos con `isWinner=true` y, si el checklist de detalle nominal está activo, también la relación de unidades/personas que votaron por cada candidato.

## Voto QR

```http
POST /api/public/voting/sessions/:sessionId/vote
Content-Type: application/json

{
  "token": "TOKEN_QR",
  "optionId": "UUID_CANDIDATO"
}
```

El segundo intento de la misma unidad en la misma actividad es rechazado por el backend y además por un índice único en PostgreSQL.

## Resultados

`GET /api/voting-sessions/:sessionId/results`

Devuelve, entre otros:

- `ballotsCast`: número total de unidades que votaron.
- `eligibleUnitsPresent`: unidades presentes habilitadas.
- `remainingUnits`: unidades presentes que aún no votan.
- `voteCount` por candidato.
- `coefficientTotal` por candidato.
- `voters` por candidato.
- `isWinner` por candidato.

La suma de `voteCount` de todos los candidatos es igual a `ballotsCast`; una misma unidad nunca puede aumentar dos candidatos dentro de la misma actividad.

## Acta

Para definir si el acta incluye quién votó por quién:

```http
PATCH /api/voting-sessions/:sessionId
Authorization: Bearer <token>
Content-Type: application/json

{
  "includeVoterDetailsInMinutes": true
}
```

Luego:

`GET /api/voting-sessions/:sessionId/results?forMinutes=true`

Si el parámetro está desactivado, el backend conserva el detalle internamente pero no lo entrega al generador del acta.


## V0.3 — Configuración de Fase 1

Ejecutar `sql/DATABASE_SCHEMA_V4_PROPERTY_CONFIGURATION.sql` después de las migraciones anteriores.

Nuevos endpoints autenticados:

- `GET /api/properties` — lista los conjuntos disponibles para el usuario.
- `GET /api/properties/:propertyId/config` — obtiene la configuración de Fase 1.
- `PUT /api/properties/:propertyId/config` — guarda la configuración completa (solo admin/superadmin).

La configuración se guarda en PostgreSQL en `property_configurations.config` (JSONB), asociada al `property_id`.


## V0.5 — Unidades y coeficientes de Fase 1

Ejecutar `sql/DATABASE_SCHEMA_V5_UNITS_FRONTEND.sql` después de V4.

Nuevos endpoints autenticados:

- `GET /api/properties/:propertyId/units` — lista unidades activas.
- `PUT /api/properties/:propertyId/units/sync` — sincroniza el listado completo (admin/superadmin).
- `PUT /api/properties/:propertyId/units/:unitId` — actualiza propietario, contacto y coeficientes.
- `DELETE /api/properties/:propertyId/units/:unitId` — desactiva una unidad sin borrar el historial.

`units.total_coefficient` queda actualizado en PostgreSQL y será el coeficiente que el backend de votaciones utiliza.
