# Flujo de Trabajo Git

## Estructura de Ramas

- `main`: Rama de producción (solo merge via PR)
- `develop`: Rama de desarrollo (todos los cambios primero aquí)
- `feature/*`: Ramas para features nuevas (opcional)

## Paso a Paso

1. **Cambiar a develop y actualizar**:
```bash
git checkout develop
git pull origin develop
```

2. **Realizar cambios**:
- Editar archivos
- `git add .`
- `git commit -m "descripcion de cambio"`

3. **Subir a develop**:
```bash
git push origin develop
```

4. **Crear Pull Request a main**:
- Ir a GitHub
- Crear PR desde `develop` hacia `main`
- Esperar que todas las verificaciones CI pasen
- Merge cuando esté listo

## Protecciones en GitHub (a configurar manualmente)

1. Ir a Settings → Branches
2. Agregar regla para `main`:
   - Requerir pull request antes de merge
   - Requerir que todas las verificaciones CI pasen
   - Requerir al menos 1 aprobación (opcional)
   - No permitir push directo
