-- Reparo pontual confirmado por auditoria do historico remoto.
-- O pagamento de R$ 153 quitou os consumos de R$ 10 + R$ 143, mas o consumo
-- de R$ 143 foi cancelado ao mudar a forma do pedido. Reativa-lo remove o
-- credito residual indevido de R$ 143 e restaura o saldo atual para R$ 144.
update public.crediario_movimentos movimento
set status = 'ativo',
    metadata = coalesce(movimento.metadata, '{}'::jsonb) || jsonb_build_object(
      'reparado_em', timezone('utc'::text, now()),
      'motivo_reparo', 'Consumo quitado cancelado indevidamente na conclusao do pedido'
    )
where movimento.id = 'b8e45a9a-48e4-4f85-93b9-649e2ef83eb8'::uuid
  and movimento.conta_id = 'adbb5878-3bf3-4ddb-a5d1-6cab0c8bbdc0'::uuid
  and movimento.pedido_id = 'aa94c73e-5676-42a3-a86b-b3901b8e1242'::uuid
  and movimento.tipo = 'consumo'
  and movimento.status = 'cancelado'
  and movimento.valor = 143;
