


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."atualizar_senha_usuario"("p_usuario_id" "uuid", "p_nova_senha" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
begin
  update public.usuarios_sistema
  set senha_hash = encode(extensions.digest(p_nova_senha, 'sha256'), 'hex')
  where id = p_usuario_id;
  return found;
end;
$$;


ALTER FUNCTION "public"."atualizar_senha_usuario"("p_usuario_id" "uuid", "p_nova_senha" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."criar_usuario_sistema"("p_nome" character varying, "p_nome_usuario" character varying, "p_senha" "text", "p_papel" character varying, "p_avatar_url" "text" DEFAULT NULL::"text", "p_cor_avatar" character varying DEFAULT '#f97316'::character varying, "p_funcionario_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
declare novo_id uuid;
begin
  insert into public.usuarios_sistema (nome, nome_usuario, senha_hash, papel, avatar_url, cor_avatar, funcionario_id)
  values (trim(p_nome), lower(trim(p_nome_usuario)), encode(extensions.digest(p_senha, 'sha256'), 'hex'), p_papel, p_avatar_url, p_cor_avatar, p_funcionario_id)
  returning id into novo_id;
  return novo_id;
end;
$$;


ALTER FUNCTION "public"."criar_usuario_sistema"("p_nome" character varying, "p_nome_usuario" character varying, "p_senha" "text", "p_papel" character varying, "p_avatar_url" "text", "p_cor_avatar" character varying, "p_funcionario_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."estatisticas_pedidos_periodo"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone) RETURNS TABLE("total_pedidos" bigint, "receita" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select
    count(*)::bigint as total_pedidos,
    coalesce(sum(total), 0)::numeric as receita
  from public.pedidos
  where created_at >= p_inicio
    and created_at <= p_fim
    and status not in ('cancelado', 'aguardando_pagamento');
$$;


ALTER FUNCTION "public"."estatisticas_pedidos_periodo"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."obter_lucro_produtos"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone) RETURNS TABLE("mes" "date", "produto_id" "uuid", "nome_produto" "text", "quantidade" bigint, "receita_com_custo" numeric, "custo_mercadorias" numeric, "lucro_bruto" numeric, "receita_sem_custo" numeric, "itens_sem_custo" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select
    date_trunc('month', pedidos.created_at)::date as mes,
    itens_pedido.produto_id,
    coalesce(nullif(itens_pedido.nome_item, ''), 'Produto')::text as nome_produto,
    sum(coalesce(itens_pedido.quantidade, 1))::bigint as quantidade,
    coalesce(sum(
      case when itens_pedido.custo_unitario is not null then itens_pedido.subtotal else 0 end
    ), 0)::numeric as receita_com_custo,
    coalesce(sum(
      case when itens_pedido.custo_unitario is not null
        then itens_pedido.custo_unitario * coalesce(itens_pedido.quantidade, 1)
        else 0
      end
    ), 0)::numeric as custo_mercadorias,
    coalesce(sum(
      case when itens_pedido.custo_unitario is not null
        then itens_pedido.subtotal - itens_pedido.custo_unitario * coalesce(itens_pedido.quantidade, 1)
        else 0
      end
    ), 0)::numeric as lucro_bruto,
    coalesce(sum(
      case when itens_pedido.custo_unitario is null then itens_pedido.subtotal else 0 end
    ), 0)::numeric as receita_sem_custo,
    coalesce(sum(
      case when itens_pedido.custo_unitario is null then coalesce(itens_pedido.quantidade, 1) else 0 end
    ), 0)::bigint as itens_sem_custo
  from public.itens_pedido
  join public.pedidos on pedidos.id = itens_pedido.pedido_id
  where pedidos.created_at >= p_inicio
    and pedidos.created_at <= p_fim
    and coalesce(pedidos.status, '') not in ('cancelado', 'aguardando_pagamento', 'pendente')
  group by 1, 2, 3;
$$;


ALTER FUNCTION "public"."obter_lucro_produtos"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."obter_pedidos_cliente_por_telefone"("p_telefone" "text", "p_limite" integer DEFAULT 30) RETURNS TABLE("id" "uuid", "numero_pedido" integer, "nome_cliente" character varying, "telefone" character varying, "status" character varying, "tipo_entrega" character varying, "forma_pagamento" character varying, "total" numeric, "created_at" timestamp with time zone, "observacoes" "text")
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  select
    pedido.id,
    pedido.numero_pedido,
    pedido.nome_cliente,
    pedido.telefone,
    pedido.status,
    pedido.tipo_entrega,
    pedido.forma_pagamento,
    pedido.total,
    pedido.created_at,
    pedido.observacoes
  from public.pedidos pedido
  where regexp_replace(coalesce(pedido.telefone, ''), E'\\D', '', 'g') = regexp_replace(coalesce(p_telefone, ''), E'\\D', '', 'g')
  order by pedido.created_at desc
  limit least(greatest(coalesce(p_limite, 30), 1), 100)
$$;


ALTER FUNCTION "public"."obter_pedidos_cliente_por_telefone"("p_telefone" "text", "p_limite" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."preencher_custo_unitario_item_pedido"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if new.custo_unitario is null and new.produto_id is not null then
    select produtos.custo_unitario
      into new.custo_unitario
      from public.produtos
     where produtos.id = new.produto_id;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."preencher_custo_unitario_item_pedido"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verificar_senha_usuario"("p_nome_usuario" character varying, "p_senha" "text") RETURNS TABLE("id" "uuid", "nome" character varying, "nome_usuario" character varying, "papel" character varying, "avatar_url" "text", "cor_avatar" character varying, "funcionario_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
begin
  return query
  select u.id, u.nome, u.nome_usuario, u.papel, u.avatar_url, u.cor_avatar, u.funcionario_id
  from public.usuarios_sistema u
  where u.nome_usuario = lower(trim(p_nome_usuario))
    and u.senha_hash = encode(extensions.digest(p_senha, 'sha256'), 'hex')
    and u.ativo = true;

  update public.usuarios_sistema
  set ultimo_acesso = now()
  where usuarios_sistema.nome_usuario = lower(trim(p_nome_usuario))
    and usuarios_sistema.senha_hash = encode(extensions.digest(p_senha, 'sha256'), 'hex')
    and usuarios_sistema.ativo = true;
end;
$$;


ALTER FUNCTION "public"."verificar_senha_usuario"("p_nome_usuario" character varying, "p_senha" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."adicionais" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" character varying NOT NULL,
    "preco" numeric NOT NULL,
    "disponivel" boolean DEFAULT true,
    "categoria" character varying,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "imagem_url" "text",
    CONSTRAINT "adicionais_preco_check" CHECK (("preco" >= (0)::numeric))
);


ALTER TABLE "public"."adicionais" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_sidebar_config" (
    "usuario_sistema_id" "uuid" NOT NULL,
    "config" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_sidebar_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bairros" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" character varying NOT NULL,
    "taxa_entrega" numeric DEFAULT 0 NOT NULL,
    "ativo" boolean DEFAULT true,
    "ordem" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "entrega_gratis" boolean DEFAULT false NOT NULL,
    CONSTRAINT "bairros_taxa_entrega_check" CHECK (("taxa_entrega" >= (0)::numeric))
);


ALTER TABLE "public"."bairros" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bebidas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" character varying NOT NULL,
    "descricao" "text",
    "preco" numeric NOT NULL,
    "categoria" character varying NOT NULL,
    "imagem_url" "text",
    "disponivel" boolean DEFAULT true,
    "ordem" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "tamanho" character varying,
    CONSTRAINT "bebidas_preco_check" CHECK (("preco" >= (0)::numeric))
);


ALTER TABLE "public"."bebidas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."caixas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "data_abertura" timestamp with time zone NOT NULL,
    "data_fechamento" timestamp with time zone,
    "valor_abertura" numeric(10,2) DEFAULT 0,
    "valor_fechamento" numeric(10,2),
    "total_entradas" numeric(10,2) DEFAULT 0,
    "total_saidas" numeric(10,2) DEFAULT 0,
    "saldo_esperado" numeric(10,2) DEFAULT 0,
    "diferenca" numeric(10,2),
    "responsavel_abertura" character varying(255),
    "responsavel_fechamento" character varying(255),
    "observacoes" "text",
    "status" character varying(20) DEFAULT 'aberto'::character varying,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "fechamento_formas" "jsonb"
);


ALTER TABLE "public"."caixas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categorias_caixa" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" character varying(100) NOT NULL,
    "tipo" character varying(20) NOT NULL,
    "descricao" "text",
    "ativo" boolean DEFAULT true,
    "cor" character varying(7),
    "icone" character varying(50),
    "ordem" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."categorias_caixa" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categorias_cardapio" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "tipo" "text" NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "ordem" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "categorias_cardapio_tipo_check" CHECK (("tipo" = ANY (ARRAY['produto'::"text", 'bebida'::"text", 'combo'::"text"])))
);


ALTER TABLE "public"."categorias_cardapio" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."combo_itens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "combo_id" "uuid" NOT NULL,
    "produto_id" "uuid",
    "bebida_id" "uuid",
    "quantidade" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    CONSTRAINT "combo_itens_quantidade_check" CHECK (("quantidade" > 0))
);


ALTER TABLE "public"."combo_itens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."combos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" character varying NOT NULL,
    "descricao" "text",
    "preco" numeric NOT NULL,
    "imagem_url" "text",
    "disponivel" boolean DEFAULT true,
    "ordem" integer DEFAULT 0,
    "destaque" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "preco_original" numeric,
    "desconto_percentual" integer,
    CONSTRAINT "combos_preco_check" CHECK (("preco" >= (0)::numeric))
);


ALTER TABLE "public"."combos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."configuracoes_loja" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chave" character varying NOT NULL,
    "valor" "text",
    "tipo" character varying DEFAULT 'string'::character varying,
    "descricao" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."configuracoes_loja" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crediario_contas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cliente_id" "uuid",
    "cliente_nome" "text" NOT NULL,
    "cliente_chave" "text" NOT NULL,
    "telefone" "text",
    "status" "text" DEFAULT 'aberto'::"text" NOT NULL,
    "saldo_atual" numeric(12,2) DEFAULT 0 NOT NULL,
    "limite_credito" numeric(12,2),
    "observacoes" "text",
    "origem" "text" DEFAULT 'manual'::"text" NOT NULL,
    "legado_id" "uuid",
    "legado_firebase_id" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "quitado_em" timestamp with time zone,
    CONSTRAINT "crediario_contas_limite_credito_check" CHECK ((("limite_credito" IS NULL) OR ("limite_credito" >= (0)::numeric))),
    CONSTRAINT "crediario_contas_status_check" CHECK (("status" = ANY (ARRAY['aberto'::"text", 'quitado'::"text", 'bloqueado'::"text", 'arquivado'::"text"])))
);


ALTER TABLE "public"."crediario_contas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crediario_movimentos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conta_id" "uuid" NOT NULL,
    "pedido_id" "uuid",
    "tipo" "text" NOT NULL,
    "status" "text" DEFAULT 'ativo'::"text" NOT NULL,
    "valor" numeric(12,2) NOT NULL,
    "descricao" "text",
    "itens" "jsonb",
    "origem" "text" DEFAULT 'manual'::"text" NOT NULL,
    "legado_id" "uuid",
    "legado_order_id" "uuid",
    "legado_firebase_id" "text",
    "realizado_em" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "criado_por" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "crediario_movimentos_status_check" CHECK (("status" = ANY (ARRAY['ativo'::"text", 'cancelado'::"text"]))),
    CONSTRAINT "crediario_movimentos_tipo_check" CHECK (("tipo" = ANY (ARRAY['consumo'::"text", 'pagamento'::"text", 'ajuste'::"text", 'estorno'::"text"]))),
    CONSTRAINT "crediario_movimentos_valor_check" CHECK (("valor" >= (0)::numeric))
);


ALTER TABLE "public"."crediario_movimentos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cupons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codigo" character varying NOT NULL,
    "nome" character varying NOT NULL,
    "descricao" "text",
    "ativo" boolean DEFAULT true NOT NULL,
    "tipo_desconto" character varying DEFAULT 'percentual'::character varying NOT NULL,
    "valor_desconto" numeric DEFAULT 0 NOT NULL,
    "pedido_minimo" numeric DEFAULT 0 NOT NULL,
    "limite_desconto" numeric,
    "uso_maximo_total" integer,
    "uso_maximo_por_cliente" integer,
    "uso_unico" boolean DEFAULT false NOT NULL,
    "total_usos" integer DEFAULT 0 NOT NULL,
    "aplica_em" character varying DEFAULT 'pedido'::character varying NOT NULL,
    "produto_id" "uuid",
    "combo_id" "uuid",
    "validade_inicio" timestamp with time zone,
    "validade_fim" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "cupons_aplica_em_check" CHECK ((("aplica_em")::"text" = ANY ((ARRAY['pedido'::character varying, 'produto'::character varying, 'combo'::character varying])::"text"[]))),
    CONSTRAINT "cupons_check" CHECK ((((("aplica_em")::"text" = 'pedido'::"text") AND ("produto_id" IS NULL) AND ("combo_id" IS NULL)) OR ((("aplica_em")::"text" = 'produto'::"text") AND ("produto_id" IS NOT NULL) AND ("combo_id" IS NULL)) OR ((("aplica_em")::"text" = 'combo'::"text") AND ("combo_id" IS NOT NULL) AND ("produto_id" IS NULL)))),
    CONSTRAINT "cupons_limite_desconto_check" CHECK ((("limite_desconto" IS NULL) OR ("limite_desconto" >= (0)::numeric))),
    CONSTRAINT "cupons_pedido_minimo_check" CHECK (("pedido_minimo" >= (0)::numeric)),
    CONSTRAINT "cupons_tipo_desconto_check" CHECK ((("tipo_desconto")::"text" = ANY ((ARRAY['percentual'::character varying, 'valor_fixo'::character varying, 'frete_gratis'::character varying])::"text"[]))),
    CONSTRAINT "cupons_total_usos_check" CHECK (("total_usos" >= 0)),
    CONSTRAINT "cupons_uso_maximo_por_cliente_check" CHECK ((("uso_maximo_por_cliente" IS NULL) OR ("uso_maximo_por_cliente" > 0))),
    CONSTRAINT "cupons_uso_maximo_total_check" CHECK ((("uso_maximo_total" IS NULL) OR ("uso_maximo_total" > 0))),
    CONSTRAINT "cupons_valor_desconto_check" CHECK (("valor_desconto" >= (0)::numeric))
);


ALTER TABLE "public"."cupons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cupons_usos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cupom_id" "uuid" NOT NULL,
    "pedido_id" "uuid" NOT NULL,
    "telefone_cliente" character varying,
    "valor_desconto" numeric DEFAULT 0 NOT NULL,
    "valor_frete_descontado" numeric DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "cupons_usos_valor_desconto_check" CHECK (("valor_desconto" >= (0)::numeric)),
    CONSTRAINT "cupons_usos_valor_frete_descontado_check" CHECK (("valor_frete_descontado" >= (0)::numeric))
);


ALTER TABLE "public"."cupons_usos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entregas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pedido_id" "uuid" NOT NULL,
    "entregador_id" "uuid",
    "status" character varying DEFAULT 'pendente'::character varying,
    "endereco_entrega" "text",
    "bairro" character varying,
    "taxa_entrega" numeric DEFAULT 0,
    "tempo_estimado" integer,
    "tempo_real" integer,
    "distancia_km" numeric,
    "observacoes" "text",
    "data_saida" timestamp with time zone,
    "data_entrega" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "excluida_repasse" boolean DEFAULT false NOT NULL,
    CONSTRAINT "entregas_taxa_entrega_check" CHECK (("taxa_entrega" >= (0)::numeric))
);


ALTER TABLE "public"."entregas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."financas_diarias" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "data_referencia" "date" NOT NULL,
    "nome_pessoa" "text" NOT NULL,
    "funcionario_id" "uuid",
    "valor" numeric(12,2) NOT NULL,
    "forma_pagamento" "text",
    "observacoes" "text",
    "movimentacao_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "financas_diarias_nome_pessoa_check" CHECK (("char_length"(TRIM(BOTH FROM "nome_pessoa")) > 0)),
    CONSTRAINT "financas_diarias_valor_check" CHECK (("valor" > (0)::numeric))
);


ALTER TABLE "public"."financas_diarias" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."formas_pagamento" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codigo" character varying NOT NULL,
    "nome" character varying NOT NULL,
    "descricao" "text",
    "tipo_taxa" character varying DEFAULT 'nenhuma'::character varying NOT NULL,
    "valor_taxa" numeric DEFAULT 0 NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "visivel_cliente" boolean DEFAULT true NOT NULL,
    "aceita_troco" boolean DEFAULT false NOT NULL,
    "ordem" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "formas_pagamento_tipo_taxa_check" CHECK ((("tipo_taxa")::"text" = ANY ((ARRAY['nenhuma'::character varying, 'percentual'::character varying, 'fixa'::character varying])::"text"[]))),
    CONSTRAINT "formas_pagamento_valor_taxa_check" CHECK (("valor_taxa" >= (0)::numeric))
);


ALTER TABLE "public"."formas_pagamento" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."funcionarios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" character varying(255) NOT NULL,
    "telefone" character varying(20),
    "tipo" character varying(50) NOT NULL,
    "ativo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "recebe_mensagem" boolean DEFAULT true,
    "cargo" character varying(100)
);


ALTER TABLE "public"."funcionarios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."item_adicionais" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_pedido_id" "uuid" NOT NULL,
    "adicional_id" "uuid",
    "nome" character varying NOT NULL,
    "preco" numeric NOT NULL,
    "quantidade" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    CONSTRAINT "item_adicionais_preco_check" CHECK (("preco" >= (0)::numeric)),
    CONSTRAINT "item_adicionais_quantidade_check" CHECK (("quantidade" > 0))
);


ALTER TABLE "public"."item_adicionais" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."itens_pedido" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pedido_id" "uuid" NOT NULL,
    "produto_id" "uuid",
    "bebida_id" "uuid",
    "combo_id" "uuid",
    "nome_item" character varying NOT NULL,
    "quantidade" integer DEFAULT 1,
    "preco_unitario" numeric NOT NULL,
    "subtotal" numeric NOT NULL,
    "observacoes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "nome_produto" character varying,
    "preco_total" numeric,
    "adicionado_por_garcom_id" "uuid",
    "subtotal_original" numeric,
    "desconto_manual" numeric DEFAULT 0 NOT NULL,
    "custo_unitario" numeric(12,2),
    CONSTRAINT "itens_pedido_custo_unitario_nao_negativo" CHECK ((("custo_unitario" IS NULL) OR ("custo_unitario" >= (0)::numeric))),
    CONSTRAINT "itens_pedido_desconto_manual_check" CHECK (("desconto_manual" >= (0)::numeric)),
    CONSTRAINT "itens_pedido_preco_unitario_check" CHECK (("preco_unitario" >= (0)::numeric)),
    CONSTRAINT "itens_pedido_quantidade_check" CHECK (("quantidade" > 0)),
    CONSTRAINT "itens_pedido_subtotal_check" CHECK (("subtotal" >= (0)::numeric))
);


ALTER TABLE "public"."itens_pedido" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."movimentacoes_caixa" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "caixa_id" "uuid",
    "categoria_id" "uuid",
    "funcionario_id" "uuid",
    "pedido_id" "uuid",
    "tipo" character varying(50) NOT NULL,
    "valor" numeric(10,2) NOT NULL,
    "descricao" "text",
    "forma_pagamento" character varying(50),
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."movimentacoes_caixa" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pagamentos_pedido" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pedido_id" "uuid" NOT NULL,
    "forma_pagamento" character varying(50) NOT NULL,
    "valor" numeric(10,2) NOT NULL,
    "troco_para" numeric(10,2),
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "troco" numeric,
    "bandeira" character varying,
    "nsu" character varying,
    "itens_pagos" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL
);


ALTER TABLE "public"."pagamentos_pedido" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pedidos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "numero_pedido" integer NOT NULL,
    "nome_cliente" character varying NOT NULL,
    "telefone" character varying,
    "tipo_entrega" character varying NOT NULL,
    "endereco_entrega" "text",
    "bairro" character varying,
    "taxa_entrega" numeric DEFAULT 0,
    "forma_pagamento" character varying,
    "troco_para" numeric,
    "subtotal" numeric NOT NULL,
    "total" numeric NOT NULL,
    "status" character varying DEFAULT 'pendente'::character varying,
    "observacoes" "text",
    "mesa_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "endereco" "text",
    "complemento" "text",
    "referencia" "text",
    "mesa" integer,
    "cupom_id" "uuid",
    "cupom_codigo" character varying,
    "tipo_desconto_cupom" character varying,
    "desconto_cupom" numeric DEFAULT 0,
    "desconto_frete" numeric DEFAULT 0,
    "comanda" integer,
    "taxa_servico" numeric DEFAULT 0 NOT NULL,
    "pagamento_online" boolean DEFAULT false NOT NULL,
    "pagamento_online_status" character varying DEFAULT 'nao_aplicavel'::character varying NOT NULL,
    "pagamento_online_pago_em" timestamp with time zone,
    "pagamento_online_gateway" character varying,
    "pagamento_online_referencia" character varying,
    "taxa_pagamento" numeric DEFAULT 0 NOT NULL,
    "origem" "text",
    "garcom_id" "uuid",
    "subtotal_original" numeric,
    "total_original" numeric,
    "desconto_itens_total" numeric DEFAULT 0 NOT NULL,
    "desconto_manual" numeric DEFAULT 0 NOT NULL,
    "cliente_id" "uuid",
    CONSTRAINT "pedidos_desconto_cupom_check" CHECK (("desconto_cupom" >= (0)::numeric)),
    CONSTRAINT "pedidos_desconto_frete_check" CHECK (("desconto_frete" >= (0)::numeric)),
    CONSTRAINT "pedidos_desconto_itens_total_check" CHECK (("desconto_itens_total" >= (0)::numeric)),
    CONSTRAINT "pedidos_desconto_manual_check" CHECK (("desconto_manual" >= (0)::numeric)),
    CONSTRAINT "pedidos_subtotal_check" CHECK (("subtotal" >= (0)::numeric)),
    CONSTRAINT "pedidos_taxa_entrega_check" CHECK (("taxa_entrega" >= (0)::numeric)),
    CONSTRAINT "pedidos_taxa_pagamento_check" CHECK (("taxa_pagamento" >= (0)::numeric)),
    CONSTRAINT "pedidos_taxa_servico_check" CHECK (("taxa_servico" >= (0)::numeric)),
    CONSTRAINT "pedidos_tipo_entrega_check" CHECK ((("tipo_entrega")::"text" = ANY ((ARRAY['entrega'::character varying, 'retirada'::character varying, 'local'::character varying])::"text"[]))),
    CONSTRAINT "pedidos_total_check" CHECK (("total" >= (0)::numeric))
);


ALTER TABLE "public"."pedidos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."produto_adicionais" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "produto_id" "uuid" NOT NULL,
    "adicional_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."produto_adicionais" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."produtos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" character varying NOT NULL,
    "descricao" "text",
    "preco" numeric NOT NULL,
    "categoria" character varying NOT NULL,
    "imagem_url" "text",
    "disponivel" boolean DEFAULT true,
    "destaque" boolean DEFAULT false,
    "ordem" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "preco_original" numeric,
    "desconto" numeric,
    "custo_unitario" numeric(12,2),
    CONSTRAINT "produtos_custo_unitario_nao_negativo" CHECK ((("custo_unitario" IS NULL) OR ("custo_unitario" >= (0)::numeric))),
    CONSTRAINT "produtos_preco_check" CHECK (("preco" >= (0)::numeric))
);


ALTER TABLE "public"."produtos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."usuarios_cliente" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "telefone" "text" NOT NULL,
    "nome" "text",
    "primeiro_pedido_em" timestamp with time zone,
    "ultimo_pedido_em" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "endereco" "text",
    "bairro" "text",
    "complemento" "text"
);


ALTER TABLE "public"."usuarios_cliente" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."usuarios_sistema" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" character varying(255) NOT NULL,
    "nome_usuario" character varying(100) NOT NULL,
    "senha_hash" "text" NOT NULL,
    "papel" character varying(20) NOT NULL,
    "avatar_url" "text",
    "cor_avatar" character varying(7) DEFAULT '#f97316'::character varying,
    "ativo" boolean DEFAULT true,
    "funcionario_id" "uuid",
    "ultimo_acesso" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    CONSTRAINT "usuarios_sistema_papel_check" CHECK ((("papel")::"text" = ANY ((ARRAY['admin'::character varying, 'garcom'::character varying, 'entregador'::character varying])::"text"[])))
);


ALTER TABLE "public"."usuarios_sistema" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_usuarios_cliente_metricas" AS
 SELECT "uc"."id",
    "uc"."telefone",
    "uc"."nome",
    "uc"."endereco",
    "uc"."bairro",
    "uc"."primeiro_pedido_em",
    "uc"."ultimo_pedido_em",
    "uc"."created_at",
    "uc"."updated_at",
    ("count"("p"."id"))::integer AS "total_pedidos",
    ("count"("p"."id") FILTER (WHERE ("lower"((COALESCE("p"."status", ''::character varying))::"text") <> 'cancelado'::"text")))::integer AS "total_pedidos_validos",
    (COALESCE("sum"(
        CASE
            WHEN ("lower"((COALESCE("p"."status", ''::character varying))::"text") <> 'cancelado'::"text") THEN "p"."total"
            ELSE (0)::numeric
        END), (0)::numeric))::numeric(12,2) AS "total_vendas",
    (COALESCE("avg"(
        CASE
            WHEN ("lower"((COALESCE("p"."status", ''::character varying))::"text") <> 'cancelado'::"text") THEN "p"."total"
            ELSE NULL::numeric
        END), (0)::numeric))::numeric(12,2) AS "ticket_medio",
    "max"("p"."created_at") AS "ultimo_pedido_data"
   FROM ("public"."usuarios_cliente" "uc"
     LEFT JOIN "public"."pedidos" "p" ON (("p"."cliente_id" = "uc"."id")))
  GROUP BY "uc"."id", "uc"."telefone", "uc"."nome", "uc"."endereco", "uc"."bairro", "uc"."primeiro_pedido_em", "uc"."ultimo_pedido_em", "uc"."created_at", "uc"."updated_at";


ALTER VIEW "public"."vw_usuarios_cliente_metricas" OWNER TO "postgres";


ALTER TABLE ONLY "public"."adicionais"
    ADD CONSTRAINT "adicionais_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_sidebar_config"
    ADD CONSTRAINT "admin_sidebar_config_pkey" PRIMARY KEY ("usuario_sistema_id");



ALTER TABLE ONLY "public"."bairros"
    ADD CONSTRAINT "bairros_nome_key" UNIQUE ("nome");



ALTER TABLE ONLY "public"."bairros"
    ADD CONSTRAINT "bairros_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bebidas"
    ADD CONSTRAINT "bebidas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."caixas"
    ADD CONSTRAINT "caixas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categorias_caixa"
    ADD CONSTRAINT "categorias_caixa_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categorias_cardapio"
    ADD CONSTRAINT "categorias_cardapio_nome_tipo_key" UNIQUE ("nome", "tipo");



ALTER TABLE ONLY "public"."categorias_cardapio"
    ADD CONSTRAINT "categorias_cardapio_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."combo_itens"
    ADD CONSTRAINT "combo_itens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."combos"
    ADD CONSTRAINT "combos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."configuracoes_loja"
    ADD CONSTRAINT "configuracoes_loja_chave_key" UNIQUE ("chave");



ALTER TABLE ONLY "public"."configuracoes_loja"
    ADD CONSTRAINT "configuracoes_loja_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crediario_contas"
    ADD CONSTRAINT "crediario_contas_cliente_chave_key" UNIQUE ("cliente_chave");



ALTER TABLE ONLY "public"."crediario_contas"
    ADD CONSTRAINT "crediario_contas_legado_id_key" UNIQUE ("legado_id");



ALTER TABLE ONLY "public"."crediario_contas"
    ADD CONSTRAINT "crediario_contas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crediario_movimentos"
    ADD CONSTRAINT "crediario_movimentos_legado_id_key" UNIQUE ("legado_id");



ALTER TABLE ONLY "public"."crediario_movimentos"
    ADD CONSTRAINT "crediario_movimentos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cupons"
    ADD CONSTRAINT "cupons_codigo_key" UNIQUE ("codigo");



ALTER TABLE ONLY "public"."cupons"
    ADD CONSTRAINT "cupons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cupons_usos"
    ADD CONSTRAINT "cupons_usos_pedido_id_key" UNIQUE ("pedido_id");



ALTER TABLE ONLY "public"."cupons_usos"
    ADD CONSTRAINT "cupons_usos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entregas"
    ADD CONSTRAINT "entregas_pedido_id_key" UNIQUE ("pedido_id");



ALTER TABLE ONLY "public"."entregas"
    ADD CONSTRAINT "entregas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financas_diarias"
    ADD CONSTRAINT "financas_diarias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."formas_pagamento"
    ADD CONSTRAINT "formas_pagamento_codigo_key" UNIQUE ("codigo");



ALTER TABLE ONLY "public"."formas_pagamento"
    ADD CONSTRAINT "formas_pagamento_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."funcionarios"
    ADD CONSTRAINT "funcionarios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."item_adicionais"
    ADD CONSTRAINT "item_adicionais_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."itens_pedido"
    ADD CONSTRAINT "itens_pedido_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."movimentacoes_caixa"
    ADD CONSTRAINT "movimentacoes_caixa_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pagamentos_pedido"
    ADD CONSTRAINT "pagamentos_pedido_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pedidos"
    ADD CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."produto_adicionais"
    ADD CONSTRAINT "produto_adicionais_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."produto_adicionais"
    ADD CONSTRAINT "produto_adicionais_produto_id_adicional_id_key" UNIQUE ("produto_id", "adicional_id");



ALTER TABLE ONLY "public"."produtos"
    ADD CONSTRAINT "produtos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usuarios_cliente"
    ADD CONSTRAINT "usuarios_cliente_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usuarios_sistema"
    ADD CONSTRAINT "usuarios_sistema_nome_usuario_key" UNIQUE ("nome_usuario");



ALTER TABLE ONLY "public"."usuarios_sistema"
    ADD CONSTRAINT "usuarios_sistema_pkey" PRIMARY KEY ("id");



CREATE INDEX "bairros_ativos_ordem_idx" ON "public"."bairros" USING "btree" ("ordem", "nome") WHERE "ativo";



CREATE INDEX "bebidas_disponiveis_categoria_ordem_idx" ON "public"."bebidas" USING "btree" ("categoria", "ordem", "nome") WHERE "disponivel";



CREATE INDEX "categorias_cardapio_ativas_ordem_idx" ON "public"."categorias_cardapio" USING "btree" ("ordem", "nome") WHERE "ativo";



CREATE INDEX "combo_itens_bebida_id_idx" ON "public"."combo_itens" USING "btree" ("bebida_id");



CREATE INDEX "combo_itens_combo_id_idx" ON "public"."combo_itens" USING "btree" ("combo_id");



CREATE INDEX "combo_itens_produto_id_idx" ON "public"."combo_itens" USING "btree" ("produto_id");



CREATE INDEX "combos_disponiveis_ordem_idx" ON "public"."combos" USING "btree" ("ordem", "nome") WHERE "disponivel";



CREATE INDEX "cupons_combo_id_idx" ON "public"."cupons" USING "btree" ("combo_id");



CREATE INDEX "cupons_produto_id_idx" ON "public"."cupons" USING "btree" ("produto_id");



CREATE INDEX "cupons_usos_cupom_id_idx" ON "public"."cupons_usos" USING "btree" ("cupom_id");



CREATE INDEX "entregas_status_idx" ON "public"."entregas" USING "btree" ("status");



CREATE INDEX "financas_diarias_data_referencia_idx" ON "public"."financas_diarias" USING "btree" ("data_referencia");



CREATE INDEX "financas_diarias_funcionario_id_idx" ON "public"."financas_diarias" USING "btree" ("funcionario_id") WHERE ("funcionario_id" IS NOT NULL);



CREATE INDEX "financas_diarias_movimentacao_id_idx" ON "public"."financas_diarias" USING "btree" ("movimentacao_id");



CREATE INDEX "formas_pagamento_cliente_ordem_idx" ON "public"."formas_pagamento" USING "btree" ("ordem", "nome") WHERE ("ativo" AND "visivel_cliente");



CREATE INDEX "funcionarios_ativos_nome_idx" ON "public"."funcionarios" USING "btree" ("ativo", "nome");



CREATE INDEX "idx_caixas_data" ON "public"."caixas" USING "btree" ("data_abertura");



CREATE INDEX "idx_caixas_status" ON "public"."caixas" USING "btree" ("status");



CREATE UNIQUE INDEX "idx_caixas_um_aberto" ON "public"."caixas" USING "btree" ("status") WHERE (("status")::"text" = 'aberto'::"text");



CREATE INDEX "idx_crediario_contas_cliente_id" ON "public"."crediario_contas" USING "btree" ("cliente_id") WHERE ("cliente_id" IS NOT NULL);



CREATE INDEX "idx_crediario_contas_status_saldo" ON "public"."crediario_contas" USING "btree" ("status", "saldo_atual" DESC, "atualizado_em" DESC);



CREATE INDEX "idx_crediario_movimentos_conta_data" ON "public"."crediario_movimentos" USING "btree" ("conta_id", "realizado_em" DESC);



CREATE INDEX "idx_crediario_movimentos_pedido" ON "public"."crediario_movimentos" USING "btree" ("pedido_id") WHERE ("pedido_id" IS NOT NULL);



CREATE UNIQUE INDEX "idx_crediario_movimentos_pedido_consumo" ON "public"."crediario_movimentos" USING "btree" ("pedido_id") WHERE (("pedido_id" IS NOT NULL) AND ("tipo" = 'consumo'::"text") AND ("origem" = 'pedido'::"text"));



CREATE INDEX "idx_itens_pedido_pedido_produto_lucro" ON "public"."itens_pedido" USING "btree" ("pedido_id", "produto_id") INCLUDE ("quantidade", "subtotal", "custo_unitario", "nome_item");



CREATE INDEX "idx_movimentacoes_caixa_caixa_created" ON "public"."movimentacoes_caixa" USING "btree" ("caixa_id", "created_at" DESC);



CREATE INDEX "idx_movimentacoes_caixa_categoria_id" ON "public"."movimentacoes_caixa" USING "btree" ("categoria_id");



CREATE INDEX "idx_movimentacoes_caixa_funcionario_id" ON "public"."movimentacoes_caixa" USING "btree" ("funcionario_id");



CREATE UNIQUE INDEX "idx_movimentacoes_caixa_pedido_unico" ON "public"."movimentacoes_caixa" USING "btree" ("pedido_id") WHERE ("pedido_id" IS NOT NULL);



CREATE INDEX "idx_movimentacoes_caixa_tipo" ON "public"."movimentacoes_caixa" USING "btree" ("tipo");



CREATE INDEX "idx_pagamentos_pedido_pedido_id" ON "public"."pagamentos_pedido" USING "btree" ("pedido_id");



CREATE INDEX "idx_usuarios_sistema_ativo" ON "public"."usuarios_sistema" USING "btree" ("ativo");



CREATE INDEX "idx_usuarios_sistema_papel" ON "public"."usuarios_sistema" USING "btree" ("papel");



CREATE INDEX "item_adicionais_adicional_id_idx" ON "public"."item_adicionais" USING "btree" ("adicional_id");



CREATE INDEX "item_adicionais_item_pedido_id_idx" ON "public"."item_adicionais" USING "btree" ("item_pedido_id");



CREATE INDEX "itens_pedido_bebida_id_idx" ON "public"."itens_pedido" USING "btree" ("bebida_id");



CREATE INDEX "itens_pedido_combo_id_idx" ON "public"."itens_pedido" USING "btree" ("combo_id");



CREATE INDEX "itens_pedido_pedido_id_idx" ON "public"."itens_pedido" USING "btree" ("pedido_id");



CREATE INDEX "itens_pedido_produto_id_idx" ON "public"."itens_pedido" USING "btree" ("produto_id");



CREATE INDEX "pedidos_cliente_id_idx" ON "public"."pedidos" USING "btree" ("cliente_id");



CREATE INDEX "pedidos_cupom_id_idx" ON "public"."pedidos" USING "btree" ("cupom_id");



CREATE INDEX "pedidos_telefone_created_at_idx" ON "public"."pedidos" USING "btree" ("telefone", "created_at" DESC);



CREATE INDEX "produto_adicionais_adicional_id_idx" ON "public"."produto_adicionais" USING "btree" ("adicional_id");



CREATE INDEX "produtos_disponiveis_categoria_ordem_idx" ON "public"."produtos" USING "btree" ("categoria", "ordem", "nome") WHERE "disponivel";



CREATE UNIQUE INDEX "uq_pagamentos_pedido_pix_online" ON "public"."pagamentos_pedido" USING "btree" ("pedido_id", "forma_pagamento") WHERE ("lower"(("forma_pagamento")::"text") = 'pix_online'::"text");



CREATE UNIQUE INDEX "usuarios_cliente_telefone_key" ON "public"."usuarios_cliente" USING "btree" ("telefone");



CREATE INDEX "usuarios_cliente_telefone_ultimo_pedido_idx" ON "public"."usuarios_cliente" USING "btree" ("telefone", "ultimo_pedido_em" DESC);



CREATE INDEX "usuarios_sistema_funcionario_id_idx" ON "public"."usuarios_sistema" USING "btree" ("funcionario_id");



CREATE OR REPLACE TRIGGER "trg_preencher_custo_unitario_item_pedido" BEFORE INSERT ON "public"."itens_pedido" FOR EACH ROW EXECUTE FUNCTION "public"."preencher_custo_unitario_item_pedido"();



ALTER TABLE ONLY "public"."admin_sidebar_config"
    ADD CONSTRAINT "admin_sidebar_config_usuario_sistema_id_fkey" FOREIGN KEY ("usuario_sistema_id") REFERENCES "public"."usuarios_sistema"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."combo_itens"
    ADD CONSTRAINT "combo_itens_bebida_id_fkey" FOREIGN KEY ("bebida_id") REFERENCES "public"."bebidas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."combo_itens"
    ADD CONSTRAINT "combo_itens_combo_id_fkey" FOREIGN KEY ("combo_id") REFERENCES "public"."combos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."combo_itens"
    ADD CONSTRAINT "combo_itens_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."crediario_contas"
    ADD CONSTRAINT "crediario_contas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."usuarios_cliente"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."crediario_movimentos"
    ADD CONSTRAINT "crediario_movimentos_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "public"."crediario_contas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crediario_movimentos"
    ADD CONSTRAINT "crediario_movimentos_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cupons"
    ADD CONSTRAINT "cupons_combo_id_fkey" FOREIGN KEY ("combo_id") REFERENCES "public"."combos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cupons"
    ADD CONSTRAINT "cupons_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cupons_usos"
    ADD CONSTRAINT "cupons_usos_cupom_id_fkey" FOREIGN KEY ("cupom_id") REFERENCES "public"."cupons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cupons_usos"
    ADD CONSTRAINT "cupons_usos_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entregas"
    ADD CONSTRAINT "entregas_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."financas_diarias"
    ADD CONSTRAINT "financas_diarias_funcionario_id_fkey" FOREIGN KEY ("funcionario_id") REFERENCES "public"."funcionarios"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."financas_diarias"
    ADD CONSTRAINT "financas_diarias_movimentacao_id_fkey" FOREIGN KEY ("movimentacao_id") REFERENCES "public"."movimentacoes_caixa"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."item_adicionais"
    ADD CONSTRAINT "item_adicionais_adicional_id_fkey" FOREIGN KEY ("adicional_id") REFERENCES "public"."adicionais"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."item_adicionais"
    ADD CONSTRAINT "item_adicionais_item_pedido_id_fkey" FOREIGN KEY ("item_pedido_id") REFERENCES "public"."itens_pedido"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."itens_pedido"
    ADD CONSTRAINT "itens_pedido_bebida_id_fkey" FOREIGN KEY ("bebida_id") REFERENCES "public"."bebidas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."itens_pedido"
    ADD CONSTRAINT "itens_pedido_combo_id_fkey" FOREIGN KEY ("combo_id") REFERENCES "public"."combos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."itens_pedido"
    ADD CONSTRAINT "itens_pedido_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."itens_pedido"
    ADD CONSTRAINT "itens_pedido_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."movimentacoes_caixa"
    ADD CONSTRAINT "movimentacoes_caixa_caixa_id_fkey" FOREIGN KEY ("caixa_id") REFERENCES "public"."caixas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."movimentacoes_caixa"
    ADD CONSTRAINT "movimentacoes_caixa_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias_caixa"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."movimentacoes_caixa"
    ADD CONSTRAINT "movimentacoes_caixa_funcionario_id_fkey" FOREIGN KEY ("funcionario_id") REFERENCES "public"."funcionarios"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."movimentacoes_caixa"
    ADD CONSTRAINT "movimentacoes_caixa_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pagamentos_pedido"
    ADD CONSTRAINT "pagamentos_pedido_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pedidos"
    ADD CONSTRAINT "pedidos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."usuarios_cliente"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pedidos"
    ADD CONSTRAINT "pedidos_cupom_id_fkey" FOREIGN KEY ("cupom_id") REFERENCES "public"."cupons"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."produto_adicionais"
    ADD CONSTRAINT "produto_adicionais_adicional_id_fkey" FOREIGN KEY ("adicional_id") REFERENCES "public"."adicionais"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."produto_adicionais"
    ADD CONSTRAINT "produto_adicionais_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."usuarios_sistema"
    ADD CONSTRAINT "usuarios_sistema_funcionario_id_fkey" FOREIGN KEY ("funcionario_id") REFERENCES "public"."funcionarios"("id") ON DELETE SET NULL;



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."atualizar_senha_usuario"("p_usuario_id" "uuid", "p_nova_senha" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."atualizar_senha_usuario"("p_usuario_id" "uuid", "p_nova_senha" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."atualizar_senha_usuario"("p_usuario_id" "uuid", "p_nova_senha" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."criar_usuario_sistema"("p_nome" character varying, "p_nome_usuario" character varying, "p_senha" "text", "p_papel" character varying, "p_avatar_url" "text", "p_cor_avatar" character varying, "p_funcionario_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."criar_usuario_sistema"("p_nome" character varying, "p_nome_usuario" character varying, "p_senha" "text", "p_papel" character varying, "p_avatar_url" "text", "p_cor_avatar" character varying, "p_funcionario_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."criar_usuario_sistema"("p_nome" character varying, "p_nome_usuario" character varying, "p_senha" "text", "p_papel" character varying, "p_avatar_url" "text", "p_cor_avatar" character varying, "p_funcionario_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."estatisticas_pedidos_periodo"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."estatisticas_pedidos_periodo"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."estatisticas_pedidos_periodo"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."obter_lucro_produtos"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."obter_lucro_produtos"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."obter_lucro_produtos"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."obter_pedidos_cliente_por_telefone"("p_telefone" "text", "p_limite" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."obter_pedidos_cliente_por_telefone"("p_telefone" "text", "p_limite" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."obter_pedidos_cliente_por_telefone"("p_telefone" "text", "p_limite" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."preencher_custo_unitario_item_pedido"() TO "anon";
GRANT ALL ON FUNCTION "public"."preencher_custo_unitario_item_pedido"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."preencher_custo_unitario_item_pedido"() TO "service_role";



GRANT ALL ON FUNCTION "public"."verificar_senha_usuario"("p_nome_usuario" character varying, "p_senha" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."verificar_senha_usuario"("p_nome_usuario" character varying, "p_senha" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verificar_senha_usuario"("p_nome_usuario" character varying, "p_senha" "text") TO "service_role";



GRANT ALL ON TABLE "public"."adicionais" TO "anon";
GRANT ALL ON TABLE "public"."adicionais" TO "authenticated";
GRANT ALL ON TABLE "public"."adicionais" TO "service_role";



GRANT ALL ON TABLE "public"."admin_sidebar_config" TO "anon";
GRANT ALL ON TABLE "public"."admin_sidebar_config" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_sidebar_config" TO "service_role";



GRANT ALL ON TABLE "public"."bairros" TO "anon";
GRANT ALL ON TABLE "public"."bairros" TO "authenticated";
GRANT ALL ON TABLE "public"."bairros" TO "service_role";



GRANT ALL ON TABLE "public"."bebidas" TO "anon";
GRANT ALL ON TABLE "public"."bebidas" TO "authenticated";
GRANT ALL ON TABLE "public"."bebidas" TO "service_role";



GRANT ALL ON TABLE "public"."caixas" TO "anon";
GRANT ALL ON TABLE "public"."caixas" TO "authenticated";
GRANT ALL ON TABLE "public"."caixas" TO "service_role";



GRANT ALL ON TABLE "public"."categorias_caixa" TO "anon";
GRANT ALL ON TABLE "public"."categorias_caixa" TO "authenticated";
GRANT ALL ON TABLE "public"."categorias_caixa" TO "service_role";



GRANT ALL ON TABLE "public"."categorias_cardapio" TO "anon";
GRANT ALL ON TABLE "public"."categorias_cardapio" TO "authenticated";
GRANT ALL ON TABLE "public"."categorias_cardapio" TO "service_role";



GRANT ALL ON TABLE "public"."combo_itens" TO "anon";
GRANT ALL ON TABLE "public"."combo_itens" TO "authenticated";
GRANT ALL ON TABLE "public"."combo_itens" TO "service_role";



GRANT ALL ON TABLE "public"."combos" TO "anon";
GRANT ALL ON TABLE "public"."combos" TO "authenticated";
GRANT ALL ON TABLE "public"."combos" TO "service_role";



GRANT ALL ON TABLE "public"."configuracoes_loja" TO "anon";
GRANT ALL ON TABLE "public"."configuracoes_loja" TO "authenticated";
GRANT ALL ON TABLE "public"."configuracoes_loja" TO "service_role";



GRANT ALL ON TABLE "public"."crediario_contas" TO "anon";
GRANT ALL ON TABLE "public"."crediario_contas" TO "authenticated";
GRANT ALL ON TABLE "public"."crediario_contas" TO "service_role";



GRANT ALL ON TABLE "public"."crediario_movimentos" TO "anon";
GRANT ALL ON TABLE "public"."crediario_movimentos" TO "authenticated";
GRANT ALL ON TABLE "public"."crediario_movimentos" TO "service_role";



GRANT ALL ON TABLE "public"."cupons" TO "anon";
GRANT ALL ON TABLE "public"."cupons" TO "authenticated";
GRANT ALL ON TABLE "public"."cupons" TO "service_role";



GRANT ALL ON TABLE "public"."cupons_usos" TO "anon";
GRANT ALL ON TABLE "public"."cupons_usos" TO "authenticated";
GRANT ALL ON TABLE "public"."cupons_usos" TO "service_role";



GRANT ALL ON TABLE "public"."entregas" TO "anon";
GRANT ALL ON TABLE "public"."entregas" TO "authenticated";
GRANT ALL ON TABLE "public"."entregas" TO "service_role";



GRANT ALL ON TABLE "public"."financas_diarias" TO "anon";
GRANT ALL ON TABLE "public"."financas_diarias" TO "authenticated";
GRANT ALL ON TABLE "public"."financas_diarias" TO "service_role";



GRANT ALL ON TABLE "public"."formas_pagamento" TO "anon";
GRANT ALL ON TABLE "public"."formas_pagamento" TO "authenticated";
GRANT ALL ON TABLE "public"."formas_pagamento" TO "service_role";



GRANT ALL ON TABLE "public"."funcionarios" TO "anon";
GRANT ALL ON TABLE "public"."funcionarios" TO "authenticated";
GRANT ALL ON TABLE "public"."funcionarios" TO "service_role";



GRANT ALL ON TABLE "public"."item_adicionais" TO "anon";
GRANT ALL ON TABLE "public"."item_adicionais" TO "authenticated";
GRANT ALL ON TABLE "public"."item_adicionais" TO "service_role";



GRANT ALL ON TABLE "public"."itens_pedido" TO "anon";
GRANT ALL ON TABLE "public"."itens_pedido" TO "authenticated";
GRANT ALL ON TABLE "public"."itens_pedido" TO "service_role";



GRANT ALL ON TABLE "public"."movimentacoes_caixa" TO "anon";
GRANT ALL ON TABLE "public"."movimentacoes_caixa" TO "authenticated";
GRANT ALL ON TABLE "public"."movimentacoes_caixa" TO "service_role";



GRANT ALL ON TABLE "public"."pagamentos_pedido" TO "anon";
GRANT ALL ON TABLE "public"."pagamentos_pedido" TO "authenticated";
GRANT ALL ON TABLE "public"."pagamentos_pedido" TO "service_role";



GRANT ALL ON TABLE "public"."pedidos" TO "anon";
GRANT ALL ON TABLE "public"."pedidos" TO "authenticated";
GRANT ALL ON TABLE "public"."pedidos" TO "service_role";



GRANT ALL ON TABLE "public"."produto_adicionais" TO "anon";
GRANT ALL ON TABLE "public"."produto_adicionais" TO "authenticated";
GRANT ALL ON TABLE "public"."produto_adicionais" TO "service_role";



GRANT ALL ON TABLE "public"."produtos" TO "anon";
GRANT ALL ON TABLE "public"."produtos" TO "authenticated";
GRANT ALL ON TABLE "public"."produtos" TO "service_role";



GRANT ALL ON TABLE "public"."usuarios_cliente" TO "anon";
GRANT ALL ON TABLE "public"."usuarios_cliente" TO "authenticated";
GRANT ALL ON TABLE "public"."usuarios_cliente" TO "service_role";



GRANT ALL ON TABLE "public"."usuarios_sistema" TO "anon";
GRANT ALL ON TABLE "public"."usuarios_sistema" TO "authenticated";
GRANT ALL ON TABLE "public"."usuarios_sistema" TO "service_role";



GRANT ALL ON TABLE "public"."vw_usuarios_cliente_metricas" TO "anon";
GRANT ALL ON TABLE "public"."vw_usuarios_cliente_metricas" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_usuarios_cliente_metricas" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







