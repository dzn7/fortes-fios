-- Excluir um pedido deve retirar do saldo somente o consumo de crediario
-- diretamente vinculado a ele, preservando o registro para auditoria.
create or replace function public.limpar_dados_pedido_excluido()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.crediario_movimentos
  set status = 'cancelado',
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'cancelado_em', timezone('utc'::text, now()),
        'motivo_cancelamento', 'Pedido excluido',
        'pedido_excluido_id', old.id
      )
  where pedido_id = old.id
    and origem = 'pedido'
    and tipo = 'consumo'
    and status = 'ativo';

  delete from public.item_adicionais where item_pedido_id in (select id from public.itens_pedido where pedido_id = old.id);
  delete from public.itens_pedido where pedido_id = old.id;
  delete from public.movimentacoes_caixa where pedido_id = old.id;
  delete from public.entregas where pedido_id = old.id;
  delete from public.pagamentos_pedido where pedido_id = old.id;
  delete from public.fila_impressao where pedido_id = old.id;
  return old;
end;
$function$;
