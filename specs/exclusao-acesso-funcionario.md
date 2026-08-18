# SPEC — Excluir funcionário tem que apagar o login junto

> Status: implementado e verificado.
> Pedido do usuário: *"corrigir erro de ao apagar/remover usuario em acesso ele
> nao sumir do /admin na tela de login"*

---

## 1. O defeito, com a evidência

Duas telas criam a **mesma pessoa** em duas tabelas:

| Tabela | O que é | Quem cria |
|---|---|---|
| `funcionarios` | quem trabalha na loja | Equipe (`/admin/funcionarios`) |
| `usuarios_sistema` | quem **faz login** | Equipe *e* Acessos (`/admin/usuarios`) |

A tela de Equipe cria as duas de uma vez (`criarAcessoParaFuncionario`), mas
apaga só uma:

```ts
// GerenciadorFuncionarios.tsx — antes
const { error } = await supabase.from('funcionarios').delete().eq('id', id)
```

O `usuarios_sistema` correspondente sobrevive. Resultado observável: a pessoa
some da lista de Equipe, **continua no cartão de perfis de `/admin/login`** e
continua entrando com a senha antiga. Não é só um resto visual — é um acesso
que devia ter sido revogado.

### 1.1 O que foi verificado no banco antes de mexer em código

Ciclo completo em `usuarios_sistema` pela Management API (criar → conferir →
apagar → conferir): **a exclusão pela aba de Acessos funciona**, remove a linha
e a pessoa some da tela de login. Nenhum trigger na tabela, nenhuma FK
bloqueando: as três FKs que apontam para `usuarios_sistema` são
`on delete set null` ou `cascade`. Portanto o caminho quebrado é o **outro** — o
da Equipe, que nunca toca em `usuarios_sistema`.

### 1.2 O segundo defeito, que impedia até a correção óbvia

Mesmo querendo apagar o acesso junto, não havia como **achá-lo**: o vínculo
nunca era gravado. `criarUsuarioSistema` monta o corpo do POST e descarta os
campos que recebeu:

```ts
// autenticacao.ts — antes
return chamarRotaAcessos('POST', {
  nome, nomeUsuario, senha, papel,        // ← funcionarioId e corAvatar sumiam aqui
  ...(dados.permissoes ? { permissoes: dados.permissoes } : {}),
})
```

E a rota `POST /api/admin/acessos` não lia nenhum dos dois. Estado real do banco
hoje: dos 3 usuários, **2 estão com `funcionario_id` nulo**, incluindo um que
tem funcionário homônimo cadastrado. A cor do avatar escolhida no cadastro
também era perdida em silêncio.

## 2. Comportamento esperado

1. Criar acesso pela Equipe grava `funcionario_id` e `cor_avatar`.
2. Excluir funcionário **primeiro** apaga o acesso vinculado, **depois** o
   funcionário. Se o acesso não puder ser apagado, o funcionário **não** é
   apagado — errar para o lado de não deixar login órfão.
3. Funcionário sem acesso vinculado é apagado normalmente.
4. As invariantes de acesso continuam valendo: ninguém apaga o próprio acesso, e
   a loja nunca fica sem administrador ativo.

## 3. Contrato — `DELETE /api/admin/acessos`

Passa a aceitar **um** de dois seletores:

| Query | Efeito |
|---|---|
| `?id=<uuid>` | apaga aquele acesso (comportamento existente, intacto) |
| `?funcionarioId=<uuid>` | apaga o(s) acesso(s) com aquele `funcionario_id` |

Resposta: `{ sucesso: true, excluidos: n }`.

`excluidos: 0` **não é erro**: funcionário sem login é caso normal, e a tela
precisa seguir para apagar o funcionário.

Permissão exigida: `acessos.excluir`, nos dois casos, antes de tocar no banco.

### 3.1 Por que apagar e não desativar

Desativar já tiraria a pessoa da tela de login (`listarUsuariosPorPapel` filtra
`ativo = true`) e bloquearia a sessão (`lerSessao` devolve `inativo`). Mas o
verbo da tela é **Excluir**, e a aba de Acessos já apaga de fato. Duas telas com
o mesmo botão e efeitos diferentes é como se chega num bug destes. Nada aponta
para `usuarios_sistema` com FK restritiva, então apagar é seguro.

## 4. Vínculos antigos

A migration `202608180001` liga os `usuarios_sistema` órfãos ao funcionário de
mesmo nome. É deliberadamente conservadora — só casa quando:

- o usuário está com `funcionario_id` nulo, **e**
- existe **exatamente um** funcionário com aquele nome normalizado, **e**
- nenhum outro usuário já reivindica aquele funcionário.

Empate ou ambiguidade → não liga. Vínculo errado é pior que vínculo ausente:
apagaria o login da pessoa errada.

## 5. Cenários de aceite

| Cenário | Esperado |
|---|---|
| Excluir funcionário com acesso vinculado | some da Equipe **e** da tela de login |
| Excluir funcionário sem acesso | some da Equipe, nada mais acontece |
| Acesso vinculado é o último admin ativo | recusa 409, funcionário **permanece** |
| Acesso vinculado é o do próprio operador | recusa 403, funcionário **permanece** |
| Excluir pela aba de Acessos | inalterado |
| Criar acesso pela Equipe | `funcionario_id` e `cor_avatar` gravados |
