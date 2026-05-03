# Flujo de Trabajo Git

## Estructura de Ramas

- `main`: Rama de producción (solo merge via PR)
- `develop`: Rama de desarrollo (todos los cambios primero aquí)
- `feature/*`: Ramas para features nuevas (opcional)

## Configuración Inicial (solo una vez)

### 1. Pushear develop por primera vez
Ya hecho ✓

### 2. Esperar que el workflow se ejecute
1. Ir a GitHub → **Actions**
2. Verás el pipeline "CI/CD Pipeline" corriendo
3. Esperar que termine (~2-5 minutos)

### 3. Agregar Secrets (si es necesario)
1. GitHub → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret**:
   - Name: `NEXT_PUBLIC_API_URL`
   - Secret: `http://localhost:8000` (o tu URL de producción)
3. Clic **Add secret**

### 4. Configurar Branch Protection para main
**¡Importante! Haz esto DESPUÉS de que el workflow se haya ejecutado al menos una vez**

1. GitHub → **Settings** → **Branches** → **Branch protection rules** → **Add rule**
2. Configurar:
   - **Branch name pattern**: `main`
   - ✅ **Require a pull request before merging**
   - ✅ **Require status checks to pass**
     - En la lista, ahora deberían aparecer: `security`, `frontend`, `backend`
   - ✅ **Do not allow bypassing the above settings**
   - (Opcional) ✅ **Require approvals**
   - (Opcional) ✅ **Require conversation resolution before merging**
3. Clic **Create**

## Flujo Diario de Trabajo

Siempre trabajar en `develop`, **nunca** directamente en `main`:

```bash
# 1. Asegurarte de estar en develop
git checkout develop

# 2. Actualizar develop antes de trabajar
git pull origin develop

# 3. Hacer cambios
# ... editar archivos ...

# 4. Commit
git add .
git commit -m "descripción clara de los cambios"

# 5. Push a develop
git push origin develop
```

## Crear Pull Request a main

Cuando los cambios estén listos para producción:
1. Ir a GitHub → **Pull requests** → **New pull request**
2. Base: `main` ← Compare: `develop`
3. Clic **Create pull request**
4. Llenar el template (descripción, checklist)
5. Esperar que todos los checks pasen (verde ✓)
6. Cuando esté listo, clic **Merge pull request**

## Después de mergear

```bash
# Actualizar develop con los cambios de main
git checkout main
git pull origin main
git checkout develop
git merge main
git push origin develop
```

