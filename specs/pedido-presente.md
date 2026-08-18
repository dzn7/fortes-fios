# SPEC — Marcar pedido para presente

> Status: implementado. Migration pendente de autorização para aplicar.
> Pedido do usuário: *"no carrinho adicione a opcao marcar para presente (deve
> ir na msg do whatsapp e tbm aparecer no admin no card do pedido que sera
> presente, de forma nitida)"*

---

## 1. Objetivo

Quem compra para presentear avisa isso no carrinho. A loja precisa **ver** esse
aviso nos dois lugares onde o pedido é lido: a mensagem do WhatsApp e o card do
pedido no admin.

## 2. Modelo de dado

Coluna nova em `pedidos`:

```sql
presente boolean not null default false
```

**Por que coluna e não `observacoes`.** O texto livre já existe e seria o
caminho preguiçoso — mas aviso de presente escondido dentro de um parágrafo não
vira badge, não vira filtro e não vira contagem. Um booleano é a diferença entre
um dado que o sistema entende e um recado que alguém pode não ler.

`not null default false` para que os 8 pedidos existentes e todo INSERT que não
conhece o campo (PDV, garçom, bot) continuem válidos sem alteração.

## 3. Escopo do que muda

| Camada | Mudança |
|---|---|
| Carrinho | opção "É para presente" na etapa de dados |
| Checkout | grava `presente` no INSERT de `pedidos` |
| WhatsApp | linha de destaque na mensagem para a loja |
| Admin | badge no card do pedido |

### 3.1 O que NÃO entra

- **Campo de mensagem/dedicatória.** Não foi pedido. Quem quiser escrever algo
  usa o campo de observações, que já existe e já vai na mensagem.
- **Ocultar preço na embalagem.** É decisão comercial da loja, não do código.
- **Filtro "só presentes" na lista do admin.** A coluna deixa isso a um passo,
  mas não foi pedido.

## 4. Mensagem do WhatsApp

A marca vai **no topo**, logo abaixo do número do pedido, antes de cliente e
itens:

```
*Pedido #42*

🎁 *PEDIDO PARA PRESENTE*

*Cliente:* …
```

**Por que no topo e não no fim.** A mensagem é lida no celular, muitas vezes com
prévia curta de notificação. Informação que muda o **preparo** do pedido tem que
ser vista antes de quem lê começar a separar os produtos. No rodapé, junto ao
total, ela chega depois da decisão.

Pedido comum não ganha linha nenhuma: uma linha "Presente: não" em toda mensagem
gasta atenção para dizer o caso normal.

## 5. Card do admin

Badge ao lado do nome do cliente, na mesma linha do "Novo", com ícone de
presente. É o lugar que já é lido primeiro e o único visível na lista sem abrir
o pedido — "de forma nítida", como pedido.

Cor: `primary` da marca, preenchido. Diferente do "Novo" (que é
`foreground`/`background`), para os dois não se confundirem quando aparecem
juntos.

## 6. Aceite

| Cenário | Esperado |
|---|---|
| Marcar no carrinho e enviar | `pedidos.presente = true` |
| Mensagem do WhatsApp com presente | linha `🎁 *PEDIDO PARA PRESENTE*` logo após o número |
| Mensagem sem presente | nenhuma linha sobre presente |
| Card no admin | badge "Presente" ao lado do nome |
| Pedido antigo (coluna default) | `false`, nada muda |
| INSERT do PDV/garçom/bot sem o campo | continua válido |

Cobertura: `tests/whatsapp.test.mjs` (asserções novas sobre a marca).
