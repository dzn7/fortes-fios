# SPEC — Acesso de desenvolvedor (`dzndev`)

> Status: implementado e verificado.
> Pedido do usuário: *"Você removeu meu alias para entrar dzndev senha 1503, para
> entrar no /admin, readicione-o sem criar user, deve ser hardcoded no código."*

---

## 1. O que existia e por que saiu

Até a task de RBAC (`specs/rbac-admin.md`), `AdminAuthContext.tsx` — componente
**client** — trazia:

```ts
if (usuario === 'edienailanches' && password === '1234') { … }
if (usuario === 'dzndev' && password === '1503') { … }
```

Duas senhas em texto claro **dentro do bundle do navegador**. Quem abrisse o
DevTools as lia. A fundação de sessão assinada substituiu esse bloco inteiro, e
o atalho do desenvolvedor foi junto — sem substituto.

## 2. O que se quer de volta

Entrar em `/admin` com `dzndev` / `1503`, sem linha em `usuarios_sistema`.

## 3. Onde a credencial mora — e por que não volta para onde estava

| Local | Vai para o bundle do browser? | Decisão |
|---|---|---|
| `src/contexts/AdminAuthContext.tsx` (era aqui) | **sim** | recusado |
| `src/lib/acesso-*.mjs` | sim, se algum client importar | recusado |
| **`src/lib/server/acesso-desenvolvedor.mjs`** | **não** | **escolhido** |

O módulo é importado só por `src/lib/server/sessao-admin.ts`, que por sua vez só
é importado por route handlers. A senha continua **hardcoded no código**, como
pedido, mas nunca é servida ao navegador — a diferença entre "está no
repositório" e "está no DevTools de qualquer visitante".

`node --test` importa o módulo direto, então o comportamento é testável sem
banco e sem browser.

## 4. Contrato

```
USUARIO_DESENVOLVEDOR = 'dzndev'
ID_DESENVOLVEDOR      = '00000000-0000-4000-8000-000000000000'
VERSAO_PERMISSOES_DESENVOLVEDOR = 0
```

| Função | Regra |
|---|---|
| `ehCredencialDesenvolvedor(usuario, senha)` | `true` só com o par exato. Usuário é comparado sem caixa e sem espaço nas pontas; a senha, byte a byte. |
| `perfilDesenvolvedor()` | devolve o `UsuarioAutorizado` sintético, papel `admin`, sempre novo (nunca uma referência compartilhada mutável). |
| `ehDesenvolvedor(id)` | `true` para o id sentinela. |
| `idAtorParaAuditoria(id)` | `null` para o desenvolvedor, o próprio id para os demais. |

### 4.1 Por que `idAtorParaAuditoria` existe

`acessos_auditoria.ator_id` é **FOREIGN KEY para `usuarios_sistema(id)`**. Como
o desenvolvedor não tem linha, gravar o id sentinela levantaria `23503` e
derrubaria a operação inteira — criar um acesso passaria a falhar quando quem
cria é o `dzndev`. A coluna é anulável (`on delete set null`), então `null` é o
valor correto: a trilha registra que a ação ocorreu sem inventar um ator que não
existe.

O mesmo vale para `salvar_acesso_usuario(p_ator_id …)`, que insere na mesma
tabela. Com `p_ator_id = null`, a guarda `if p_ator_id = p_alvo_id` avalia para
`NULL` — nunca verdadeiro —, o que é o comportamento certo: o desenvolvedor não
tem acesso próprio para editar.

## 5. Fluxo

```
POST /api/admin/sessao  { nomeUsuario: 'dzndev', senha: '1503' }
   └─ autenticar()
        ├─ ehCredencialDesenvolvedor? → perfilDesenvolvedor()   ← sem tocar no banco
        └─ senão → RPC autenticar_usuario_admin
   └─ cookie httpOnly assinado (HMAC-SHA256), payload { usuarioId, papel, versao }

GET /api/admin/sessao
   └─ lerSessao()
        ├─ assinatura inválida → 401
        ├─ usuarioId == ID_DESENVOLVEDOR → perfilDesenvolvedor()  ← sem tocar no banco
        └─ senão → RPC obter_sessao_admin + confere ativo/versão
```

A sessão do desenvolvedor **é assinada como qualquer outra**. Sem o
`ADMIN_SESSAO_SECRET` ninguém forja o id sentinela: o atalho não enfraquece o
cookie.

## 6. Estados e casos de borda

| Cenário | Esperado |
|---|---|
| `dzndev` / senha errada | 401, mensagem genérica (não revela que o usuário existe) |
| `DZNDEV ` / `1503` | entra (usuário normalizado) |
| `dzndev` / `1503 ` (espaço na senha) | **não** entra — senha não é normalizada |
| Alguém cria `dzndev` em `usuarios_sistema` | o hardcoded vence: é conferido antes do banco |
| `dzndev` aparece na lista de perfis do login? | **não** — a lista vem de `usuarios_sistema` |
| `dzndev` cria/edita/exclui acesso | funciona; auditoria grava `ator_id = null` |
| Cookie forjado com o id sentinela | recusado — assinatura não confere |

## 7. Aceite

- [x] `dzndev` / `1503` entra em `/admin` pelo formulário "Entrar com usuário e senha"
- [x] Nenhuma linha nova em `usuarios_sistema`
- [x] A string `1503` **não** aparece em nenhum arquivo servido ao navegador
- [x] Criar um acesso logado como `dzndev` não levanta erro de FK
- [x] `node --test tests/acesso-desenvolvedor.test.mjs` verde

## 8. Risco aceito (decisão do usuário)

Senha fixa e curta versionada no repositório: quem tem acesso ao código tem
acesso ao Admin. Foi pedido explicitamente. Mitigação aplicada: a credencial não
vai para o bundle público e a rota de sessão continua com origem validada.
Trocar a senha exige deploy.
