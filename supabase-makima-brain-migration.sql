create table if not exists public.neural_nodes (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null references public.profiles(id) on delete cascade,
  token text not null check (char_length(token) between 2 and 40),
  embedding double precision[] not null check (cardinality(embedding) = 32),
  activation_count bigint not null default 1 check (activation_count > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, token)
);

create table if not exists public.synaptic_edges (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null references public.profiles(id) on delete cascade,
  source_node uuid not null references public.neural_nodes(id) on delete cascade,
  target_node uuid not null references public.neural_nodes(id) on delete cascade,
  weight double precision not null default 0 check (weight between -1 and 1),
  activation_count bigint not null default 1 check (activation_count > 0),
  updated_at timestamptz not null default now(),
  check (source_node < target_node),
  unique(owner_id, source_node, target_node)
);

create table if not exists public.episodic_memories (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 3 and 1000),
  embedding double precision[] not null check (cardinality(embedding) = 32),
  event_type text not null check (event_type in ('teach', 'reinforce', 'correct')),
  reward double precision not null check (reward between -1 and 1),
  created_at timestamptz not null default now()
);

create index if not exists neural_nodes_owner_updated_idx on public.neural_nodes(owner_id, updated_at desc);
create index if not exists synaptic_edges_owner_weight_idx on public.synaptic_edges(owner_id, weight desc);
create index if not exists episodic_memories_owner_created_idx on public.episodic_memories(owner_id, created_at desc);
alter table public.neural_nodes enable row level security;
alter table public.synaptic_edges enable row level security;
alter table public.episodic_memories enable row level security;
revoke all on public.neural_nodes, public.synaptic_edges, public.episodic_memories from public, anon, authenticated;
grant all on public.neural_nodes, public.synaptic_edges, public.episodic_memories to service_role;

create or replace function public.makima_brain_snapshot(p_owner_id text)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'nodes', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'token', token, 'embedding', embedding, 'activation_count', activation_count, 'updated_at', updated_at) order by updated_at desc) from (select * from public.neural_nodes where owner_id = p_owner_id order by updated_at desc limit 120) n), '[]'::jsonb),
    'edges', coalesce((select jsonb_agg(jsonb_build_object('source_node', source_node, 'target_node', target_node, 'weight', weight, 'activation_count', activation_count) order by abs(weight) desc) from (select * from public.synaptic_edges where owner_id = p_owner_id order by abs(weight) desc limit 250) e), '[]'::jsonb),
    'episodes', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'content', content, 'event_type', event_type, 'reward', reward, 'created_at', created_at) order by created_at desc) from (select * from public.episodic_memories where owner_id = p_owner_id order by created_at desc limit 50) m), '[]'::jsonb)
  );
$$;

create or replace function public.makima_brain_recall(p_owner_id text, p_embedding double precision[])
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  matched_nodes jsonb;
  matched_edges jsonb;
  matched_episodes jsonb;
  matched_ids uuid[];
begin
  if cardinality(p_embedding) <> 32 then
    raise exception 'Invalid query embedding.' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'token', token, 'similarity', similarity) order by similarity desc), '[]'::jsonb)
  into matched_nodes
  from (
    select id, token, similarity from (
      select n.id, n.token,
        (select coalesce(sum(node_value.value * query_value.value), 0)
         from unnest(n.embedding) with ordinality as node_value(value, position)
         join unnest(p_embedding) with ordinality as query_value(value, position) using (position)) as similarity
      from public.neural_nodes n where n.owner_id = p_owner_id
    ) ranked_nodes
    where similarity > 0.15
    order by similarity desc limit 6
  ) selected_nodes;
  select array_agg((value ->> 'id')::uuid) into matched_ids from jsonb_array_elements(matched_nodes);
  select coalesce(jsonb_agg(jsonb_build_object('source_node', source_node, 'target_node', target_node, 'source_token', source_token, 'target_token', target_token, 'weight', weight) order by abs(weight) desc), '[]'::jsonb)
  into matched_edges
  from (
    select e.source_node, e.target_node, e.weight, source_node.token as source_token, target_node.token as target_token
    from public.synaptic_edges e
    join public.neural_nodes source_node on source_node.id = e.source_node and source_node.owner_id = p_owner_id
    join public.neural_nodes target_node on target_node.id = e.target_node and target_node.owner_id = p_owner_id
    where e.owner_id = p_owner_id and (e.source_node = any(matched_ids) or e.target_node = any(matched_ids))
    order by abs(e.weight) desc limit 20
  ) related_edges;
  select coalesce(jsonb_agg(jsonb_build_object('content', content, 'event_type', event_type, 'similarity', similarity) order by similarity desc), '[]'::jsonb)
  into matched_episodes
  from (
    select content, event_type, similarity from (
      select m.content, m.event_type,
        (select coalesce(sum(memory_value.value * query_value.value), 0)
         from unnest(m.embedding) with ordinality as memory_value(value, position)
         join unnest(p_embedding) with ordinality as query_value(value, position) using (position)) as similarity
      from public.episodic_memories m where m.owner_id = p_owner_id
    ) ranked_episodes
    where similarity > 0.15
    order by similarity desc limit 4
  ) selected_episodes;
  return jsonb_build_object('nodes', matched_nodes, 'edges', matched_edges, 'episodes', matched_episodes);
end;
$$;

create or replace function public.makima_learn(
  p_owner_id text,
  p_memory text,
  p_terms jsonb,
  p_episode_embedding double precision[],
  p_reward double precision,
  p_event_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  term jsonb;
  token_value text;
  token_embedding double precision[];
  node_id uuid;
  node_ids uuid[] := '{}';
  episode_id uuid;
  left_index integer;
  right_index integer;
  edge_count integer := 0;
begin
  if char_length(trim(p_memory)) not between 3 and 1000
     or jsonb_typeof(p_terms) <> 'array'
     or jsonb_array_length(p_terms) not between 1 and 20
    or cardinality(p_episode_embedding) <> 32
     or p_reward not between -1 and 1
     or p_event_type not in ('teach', 'reinforce', 'correct') then
    raise exception 'Invalid brain learning input.' using errcode = '22023';
  end if;

  insert into public.episodic_memories(owner_id, content, embedding, event_type, reward)
  values (p_owner_id, trim(p_memory), p_episode_embedding, p_event_type, p_reward)
  returning id into episode_id;

  for term in select value from jsonb_array_elements(p_terms) loop
    token_value := lower(trim(term ->> 'token'));
    select array_agg(value::double precision order by ordinal)
    into token_embedding
    from jsonb_array_elements_text(term -> 'embedding') with ordinality as values_list(value, ordinal);
    if char_length(token_value) not between 2 and 40 or cardinality(token_embedding) <> 32 then
      raise exception 'Invalid neural token.' using errcode = '22023';
    end if;
    insert into public.neural_nodes(owner_id, token, embedding)
    values (p_owner_id, token_value, token_embedding)
    on conflict (owner_id, token) do update
      set embedding = excluded.embedding,
          activation_count = public.neural_nodes.activation_count + 1,
          updated_at = now()
    returning id into node_id;
    node_ids := array_append(node_ids, node_id);
  end loop;

  if cardinality(node_ids) > 1 then
    for left_index in 1..cardinality(node_ids) - 1 loop
      for right_index in left_index + 1..cardinality(node_ids) loop
        insert into public.synaptic_edges(owner_id, source_node, target_node, weight)
        values (p_owner_id, least(node_ids[left_index], node_ids[right_index]), greatest(node_ids[left_index], node_ids[right_index]), 0.05 * p_reward)
        on conflict (owner_id, source_node, target_node) do update
          set weight = greatest(-1, least(1, public.synaptic_edges.weight + 0.05 * p_reward)),
              activation_count = public.synaptic_edges.activation_count + 1,
              updated_at = now();
        edge_count := edge_count + 1;
      end loop;
    end loop;
  end if;
  return jsonb_build_object('episodeId', episode_id, 'learnedNodes', cardinality(node_ids), 'updatedEdges', edge_count);
end;
$$;

revoke all on function public.makima_brain_snapshot(text) from public, anon, authenticated;
revoke all on function public.makima_brain_recall(text, double precision[]) from public, anon, authenticated;
revoke all on function public.makima_learn(text, text, jsonb, double precision[], double precision, text) from public, anon, authenticated;
grant execute on function public.makima_brain_snapshot(text) to service_role;
grant execute on function public.makima_brain_recall(text, double precision[]) to service_role;
grant execute on function public.makima_learn(text, text, jsonb, double precision[], double precision, text) to service_role;