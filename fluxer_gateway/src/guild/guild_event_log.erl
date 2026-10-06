%% SPDX-License-Identifier: AGPL-3.0-or-later
-module(guild_event_log).
-export([voice/3, voice/4, presence/4, project/2]).

-ifdef(TEST).
-include_lib("eunit/include/eunit.hrl").
-endif.

%% Take transitions from the mutation, never from initial snapshot hydration.
voice(Before, After, State) ->
    voice(Before, After, State, null).
voice(Before, After, State, ActorId) ->
    UserId = maps:get(<<"user_id">>, After, null),
    transition(<<"voice">>, UserId, Before, After, State, ActorId).

presence(UserId, Before, After, State) when is_map(Before), map_size(Before) > 0 ->
    transition(<<"presence">>, integer_to_binary(UserId), Before, After, State, integer_to_binary(UserId));
presence(_, _, _, _) -> ok.

project(<<"voice">>, Value) ->
    maps:with([<<"channel_id">>, <<"self_mute">>, <<"self_deaf">>, <<"self_video">>, <<"self_stream">>, <<"suppress">>], Value);
project(<<"presence">>, Value) ->
    Status = maps:get(<<"status">>, Value, <<"offline">>),
    Visible = case Status of <<"invisible">> -> <<"offline">>; _ -> Status end,
    Custom = case maps:get(<<"custom_status">>, Value, null) of
        null -> null;
        Item when is_map(Item) -> iolist_to_binary(json:encode(maps:with([<<"text">>, <<"emoji_id">>, <<"emoji_name">>], Item)))
    end,
    #{<<"status">> => Visible, <<"custom_status">> => Custom}.

transition(Family, UserId, Before, After, State, ActorId) ->
    GuildId = maps:get(id, State, undefined),
    case {GuildId, UserId, os:getenv("NETRCOL_AUTOMATIONS_ENABLED")} of
        {G, U, Enabled} when is_integer(G), G > 0, is_binary(U), Enabled =/= "false" ->
            Old = case Before of null -> null; _ -> project(Family, Before) end,
            New = project(Family, After),
            case Old =:= New of
                true -> ok;
                false ->
                    %% Stable for retries of this RPC; no claim of durability before API receipt.
                    Origin = iolist_to_binary([Family, <<":">>, integer_to_binary(G), <<":">>, U, <<":">>, integer_to_binary(erlang:unique_integer([positive, monotonic])), <<":">>, integer_to_binary(erlang:system_time(nanosecond))]),
                    Request = #{<<"type">> => <<"event_log_transition">>, <<"family">> => Family, <<"guild_id">> => integer_to_binary(G), <<"user_id">> => U, <<"actor_id">> => ActorId, <<"source_id">> => Origin, <<"occurred_at">> => erlang:system_time(millisecond), <<"before">> => Old, <<"after">> => New},
                    spawn(fun() ->
                        case rpc_client:call_with_retry(Request, {5, 200, 5000, 100}) of
                            {ok, _} -> ok;
                            {error, Reason} -> logger:warning("Event log transition delivery failed", #{guild_id => G, reason => Reason})
                        end
                    end), ok
            end;
        _ -> ok
    end.

-ifdef(TEST).
public_presence_projection_test() ->
    ?assertEqual(#{<<"status">> => <<"offline">>, <<"custom_status">> => null}, project(<<"presence">>, #{<<"status">> => <<"invisible">>, <<"user">> => #{<<"email">> => <<"private">>}})).
voice_projection_excludes_secrets_test() ->
    ?assertEqual(#{<<"channel_id">> => <<"1">>, <<"self_mute">> => true}, project(<<"voice">>, #{<<"channel_id">> => <<"1">>, <<"self_mute">> => true, <<"token">> => <<"private">>, <<"member">> => #{}})).
initial_presence_is_ignored_test() ->
    ?assertEqual(ok, presence(1, #{}, #{<<"status">> => <<"online">>}, #{id => 1})).
-endif.
