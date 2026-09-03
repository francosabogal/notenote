# notenoté

Aplicación web de notas sincronizada con Supabase.

## Variables de entorno

Copia `.env.local.example` como `.env.local` y completa:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

No pongas una Secret key en el frontend.

## Desarrollo local

```bash
npm install
npm run dev
```

## Supabase

La tabla `public.notes` debe existir con RLS y las políticas para que cada usuario acceda únicamente a sus notas.

Para sincronización en tiempo real entre dispositivos, habilita la tabla `notes` en la publicación/realtime de Supabase.
