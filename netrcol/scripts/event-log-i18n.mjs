// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import {resolve} from 'node:path';
process.chdir(resolve(import.meta.dirname, '../..'));
const check = process.argv.includes('--check');
const write = (path, output) => {if(check){if(fs.readFileSync(path,'utf8')!==output)throw Error('Translation mismatch: '+path);}else fs.writeFileSync(path,output);};
const root='fluxer_app/src/features/i18n/locales';
const parse = (text) => new Map(text.split(/\r?\n\r?\n/).flatMap(block=>{const parts=block.split(/\r?\n/); let id='', val='', mode=''; for(const line of parts) {if(line.startsWith('msgid ')){id=JSON.parse(line.slice(6));mode='id';} else if(line.startsWith('msgstr ')){val=JSON.parse(line.slice(7));mode='val';} else if(line.startsWith('"')) {if(mode==='id')id+=JSON.parse(line);if(mode==='val')val+=JSON.parse(line);}} return id?[[id,val]]:[];}));
const native=parse(fs.readFileSync(`${root}/en-US/messages.po`,'utf8'));
const entries=[...fs.readFileSync('packages/constants/src/EventLogConstants.ts','utf8').matchAll(/\{id: '([^']+)', category: '([^']+)', title: '([^']+)'/g)].map(m=>({id:m[1],category:m[2],title:m[3]}));
const pairs={member_join:['Members','Join'],member_leave:['Members','Leave'],bot_add:['Bot','Add'],member_update:['Community','Profile','Edit'],user_profile_update:['User','Profile','Edit'],member_kick:['Members','Kick'],member_prune:['Members','Remove'],member_ban_add:['Members','Ban'],member_ban_remove:['Members','Ban','Remove'],member_timeout:['Members','Timeout','Edit'],member_server_mute:['Community','Mute','Edit'],member_server_deaf:['Community','Deafen','Edit'],member_move:['Moderation','Move'],member_disconnect:['Moderation','Disconnect'],message_create:['Message','Create'],message_update:['Message','Edit'],message_delete:['Message','Delete'],message_bulk_delete:['Messages','Delete'],message_pin:['Message','Pin'],message_unpin:['Message','Unpin'],message_publish:['Messages','Publish'],reaction_add:['Reactions','Add'],reaction_remove:['Reactions','Remove'],reaction_clear:['Reactions','Clear'],reaction_clear_emoji:['Emoji','Reactions','Clear'],channel_create:['Channel','Create'],channel_update:['Channel','Edit'],channel_delete:['Channel','Delete'],channel_overwrite_create:['Channel','Permissions','Add'],channel_overwrite_update:['Channel','Permissions','Edit'],channel_overwrite_delete:['Channel','Permissions','Remove'],role_create:['Roles','Create'],role_update:['Roles','Edit'],role_delete:['Roles','Delete'],member_role_update:['Members','Roles','Edit'],invite_create:['Invites','Create'],invite_update:['Invites','Edit'],invite_delete:['Invites','Delete'],invite_use:['Invites','Join'],webhook_create:['Webhooks','Create'],webhook_update:['Webhooks','Edit'],webhook_delete:['Webhooks','Delete'],emoji_create:['Emoji','Create'],emoji_update:['Emoji','Edit'],emoji_delete:['Emoji','Delete'],sticker_create:['Stickers','Create'],sticker_update:['Stickers','Edit'],sticker_delete:['Stickers','Delete'],guild_update:['Community','Settings','Edit'],voice_join:['Voice','Join'],voice_leave:['Voice','Leave'],voice_move:['Voice','Move'],voice_self_mute:['Voice','Mute','Edit'],voice_self_deaf:['Voice','Deafen','Edit'],voice_video:['Video','Edit'],voice_stream:['Screen share','Edit'],voice_suppress:['Voice','Suppress','Edit'],entrance_sound_play:['Entrance sounds','Play'],presence_status:['Status','Edit'],presence_custom_status:['Custom status','Edit']};
const categories={members:['Members','Profile'],moderation:['Moderation'],messages:['Messages'],reactions:['Reactions'],channels:['Channels','Categories'],permissions:['Channel','Permissions'],roles:['Roles'],invites:['Invites'],integrations:['Webhooks','Emoji','Stickers'],guild:['Community'],voice:['Voice','Status']};
const common={search:['Search'],selectAll:['Select all'],clear:['Clear selection'],inherit:['Inherit'],defaultChannel:['Default','Channel'],capture:['Message','Text'],preview:['Preview'],test:['Send test message'],time:['Time'],actor:['User'],target:['ID'],source:['Channel'],reason:['Reason'],unknown:['Unknown'],before:['Previous'],after:['New'],changes:['Settings','Edit'],attachments:['Attachments'],count:['Messages'],fileType:['File format'],size:['Size'],enabled:['Enabled'],disabled:['Disabled'],system:['System'],testMark:['Test message']};
const fields={name:'Name',nick:'Nickname',username:'Username',discriminator:'Discriminator',global_name:'Display name',avatar_hash:'Avatar',banner_hash:'Banner',bio:'Bio',pronouns:'Pronouns',accent_color:'Accent color',roles:'Roles','$add':'Add','$remove':'Remove',permissions:'Permissions',color:'Color',hoist:'Display role members separately from online members',mentionable:'Allow anyone to mention this role',position:'Position',hoist_position:'Position',icon:'Icon',icon_hash:'Icon',unicode_emoji:'Emoji',topic:'Topic',type:'Channel type',parent_id:'Category',nsfw:'Mature content',rate_limit_per_user:'Slowmode',bitrate:'Bitrate',user_limit:'User limit',voice_connection_limit:'User limit',rtc_region:'Region',permission_overwrites:'Permissions',allow:'Allow',deny:'Deny',id:'ID',owner_id:'Owner',verification_level:'Verification level',default_message_notifications:'Notification settings',explicit_content_filter:'Content filter',afk_channel_id:'AFK channel',afk_timeout:'AFK timeout',system_channel_id:'System messages channel',system_channel_flags:'System messages',splash_hash:'Invite background',embed_splash_hash:'Invite background',description:'Description',features:'Features',vanity_url_code:'Custom invite link',disabled_operations:'Disabled',max_age:'Expires after',max_uses:'Max uses',uses:'Uses',temporary:'Temporary membership',channel_id:'Channel',inviter_id:'User',creator_id:'User',guild_id:'Community',available:'Available',mute:'Mute',deaf:'Deafen',communication_disabled_until:'Timeout',url:'URL',format_type:'File format',tags:'Tags',flags:'Flags',animated:'Animated',content:'Message',attachments:'Attachments',embeds:'Embeds',sticker_items:'Stickers',status:'Status',custom_status:'Custom status',self_mute:'Mute',self_deaf:'Deafen',self_video:'Video',self_stream:'Screen share',suppress:'Suppress',count:'Messages',channel:'Channel',author_id:'Author',user_id:'User',emoji:'Emoji',code:'Invite code',duration_ms:'Duration',content_type:'File format',test:'Test message'};
// Native UI labels are already translated by Fluxer's language teams. Aliases keep terminology consistent.
const aliases={'Pin':'Pin message','Unpin':'Unpin message','Suppress':'Suppressed','Previous':'Old','New':'New','Test message':'Send test message','ID':'ID','Position':'Position','Owner':'Community owner','AFK channel':'AFK / idle channel','AFK timeout':'AFK timeout','File format':'Format','Content filter':'Explicit media content filter','Author':'User','Discriminator':'Tag','Flags':'Settings','Features':'Settings'};
Object.assign(fields, {banner_width:'Width',banner_height:'Height',splash_width:'Width',splash_height:'Height',splash_card_alignment:'Alignment',embed_splash_width:'Width',embed_splash_height:'Height',mfa_level:'Two-factor authentication',nsfw_level:'Mature content',content_warning_level:'Content warning',content_warning_text:'Content warning',rules_channel_id:'Rules channel',member_count:'Members',message_history_cutoff:'Message history',emoji_id:'Emoji',sticker_id:'Stickers',previous_attachments:'Attachments'});
Object.assign(aliases, {'Width':'Size','Height':'Size','Alignment':'Invite background','Two-factor authentication':'Two-factor authentication','Content warning':'Mature Content','Rules channel':'Channel','Message history':'Messages'});
const fallback={'Entrance sounds':'Entrance sound','Topic':'Channel topic','Verification level':'Verification','Notification settings':'Notifications','Explicit media content filter':'Moderation','System messages channel':'System messages','Custom invite link':'Custom invite URL','Expires after':'Expiration','Max uses':'Maximum uses','Temporary membership':'Temporary','Mature content':'Mature content channel','Channel type':'Channel','Region':'Voice region','Old':'Previous','New':'Create','Duration':'Time'};
Object.assign(aliases, {'Suppress':'Speak', 'Send test message':'netrcol.application_settings.logs.test', 'Test message':'netrcol.application_settings.logs.test', 'File format':'File', 'Display role members separately from online members':'Display separately', 'Allow anyone to mention this role':'Mentionable', 'User limit':'Connection limit', 'System messages channel':'System & welcome', 'System messages':'System & welcome', 'Custom invite link':'Invites', 'Expires after':'Expire after', 'Max uses':'Uses', 'Animated':'Animated emoji', 'Invite code':'Code'});
aliases['Display role members separately from online members']='Show this role separately';
aliases['Allow anyone to mention this role']='Allow mentions for this role';
function key(input){if(input==='ID')return input;let value=native.has(input)?input:aliases[input]??input; if(!native.has(value))value=fallback[value]??fallback[input]??value; if(!native.has(value)){const found=[...native.keys()].find(k=>k.toLowerCase()===value.toLowerCase());if(found)value=found;} if(!native.has(value))throw Error('Missing native label '+input+' -> '+value);return value;}
const custom={
 'en-US':['Fluxer does not produce this event yet.','Includes bots and private community channels.','Copied message text is visible to everyone who can read the log channel. Source files are not archived.'],
 ar:['لا ينتج Fluxer هذا الحدث بعد.','يشمل الروبوتات وقنوات المجتمع الخاصة.','نص الرسالة المنسوخ مرئي لكل من يمكنه قراءة قناة السجل. لا تُؤرشف الملفات الأصلية.'],
 bg:['Fluxer все още не генерира това събитие.','Включва ботове и частни канали на общността.','Копираният текст се вижда от всички с достъп до канала за записи. Оригиналните файлове не се архивират.'],
 cs:['Fluxer tuto událost zatím nevytváří.','Zahrnuje boty a soukromé kanály komunity.','Zkopírovaný text zprávy vidí všichni, kdo mohou číst kanál záznamů. Původní soubory se nearchivují.'],
 da:['Fluxer udsender endnu ikke denne hændelse.','Omfatter bots og private fællesskabskanaler.','Kopieret beskedtekst kan ses af alle, der kan læse logkanalen. Kildefiler arkiveres ikke.'],
 de:['Fluxer erzeugt dieses Ereignis noch nicht.','Umfasst Bots und private Community-Kanäle.','Kopierter Nachrichtentext ist für alle sichtbar, die den Protokollkanal lesen können. Quelldateien werden nicht archiviert.'],
 el:['Το Fluxer δεν παράγει ακόμη αυτό το συμβάν.','Περιλαμβάνει bot και ιδιωτικά κανάλια της κοινότητας.','Το αντιγραμμένο κείμενο είναι ορατό σε όσους μπορούν να διαβάσουν το κανάλι καταγραφής. Τα αρχικά αρχεία δεν αρχειοθετούνται.'],
 'es-ES':['Fluxer todavía no genera este evento.','Incluye bots y canales privados de la comunidad.','El texto copiado es visible para quienes pueden leer el canal de registros. Los archivos originales no se archivan.'],
 fi:['Fluxer ei vielä tuota tätä tapahtumaa.','Sisältää botit ja yhteisön yksityiset kanavat.','Kopioitu viestiteksti näkyy kaikille, jotka voivat lukea lokikanavaa. Alkuperäisiä tiedostoja ei arkistoida.'],
 fr:['Fluxer ne produit pas encore cet événement.','Inclut les bots et les salons privés de la communauté.','Le texte copié est visible par toute personne pouvant lire le salon des journaux. Les fichiers sources ne sont pas archivés.'],
 he:['Fluxer עדיין אינו יוצר אירוע זה.','כולל בוטים וערוצי קהילה פרטיים.','טקסט ההודעה שהועתק גלוי לכל מי שיכול לקרוא את ערוץ היומן. קובצי המקור אינם נשמרים בארכיון.'],
 hi:['Fluxer अभी यह घटना उत्पन्न नहीं करता।','इसमें बॉट और समुदाय के निजी चैनल शामिल हैं।','कॉपी किया गया संदेश उन सभी को दिखता है जो लॉग चैनल पढ़ सकते हैं। मूल फ़ाइलें संग्रहित नहीं की जातीं।'],
 hr:['Fluxer još ne proizvodi ovaj događaj.','Uključuje botove i privatne kanale zajednice.','Kopirani tekst vide svi koji mogu čitati kanal zapisnika. Izvorne datoteke ne arhiviraju se.'],
 hu:['A Fluxer még nem hozza létre ezt az eseményt.','A botokat és a közösség privát csatornáit is tartalmazza.','A másolt üzenetszöveget mindenki láthatja, aki olvashatja a naplócsatornát. A forrásfájlok nem kerülnek archiválásra.'],
 id:['Fluxer belum menghasilkan peristiwa ini.','Mencakup bot dan kanal komunitas privat.','Teks pesan yang disalin terlihat oleh siapa pun yang dapat membaca kanal log. Berkas sumber tidak diarsipkan.'],
 it:['Fluxer non genera ancora questo evento.','Include bot e canali privati della comunità.','Il testo copiato è visibile a chiunque possa leggere il canale dei registri. I file originali non vengono archiviati.'],
 ja:['Fluxer はまだこのイベントを生成していません。','ボットとコミュニティの非公開チャンネルも含みます。','コピーされたメッセージはログチャンネルを閲覧できる全員に表示されます。元のファイルは保存されません。'],
 ko:['Fluxer는 아직 이 이벤트를 생성하지 않습니다.','봇과 커뮤니티의 비공개 채널도 포함합니다.','복사된 메시지는 로그 채널을 읽을 수 있는 모든 사람에게 표시됩니다. 원본 파일은 보관하지 않습니다.'],
 lt:['Fluxer dar negeneruoja šio įvykio.','Apima robotus ir privačius bendruomenės kanalus.','Nukopijuotą tekstą mato visi, galintys skaityti žurnalo kanalą. Pradiniai failai nearchyvuojami.'],
 nl:['Fluxer genereert deze gebeurtenis nog niet.','Omvat bots en privékanalen van de community.','Gekopieerde berichttekst is zichtbaar voor iedereen die het logkanaal kan lezen. Bronbestanden worden niet gearchiveerd.'],
 no:['Fluxer produserer ikke denne hendelsen ennå.','Omfatter roboter og private fellesskapskanaler.','Kopiert meldingstekst er synlig for alle som kan lese loggkanalen. Kildefiler arkiveres ikke.'],
 pl:['Fluxer nie generuje jeszcze tego zdarzenia.','Obejmuje boty i prywatne kanały społeczności.','Skopiowany tekst widzą wszyscy, którzy mogą czytać kanał dziennika. Pliki źródłowe nie są archiwizowane.'],
 'pt-BR':['O Fluxer ainda não gera este evento.','Inclui bots e canais privados da comunidade.','O texto copiado fica visível para quem pode ler o canal de registros. Os arquivos originais não são arquivados.'],
 ro:['Fluxer nu generează încă acest eveniment.','Include boți și canale private ale comunității.','Textul copiat este vizibil pentru toți cei care pot citi canalul jurnalului. Fișierele originale nu sunt arhivate.'],
 ru:['Fluxer пока не создаёт это событие.','Включает ботов и приватные каналы сообщества.','Скопированный текст виден всем, кто может читать канал журналов. Исходные файлы не архивируются.'],
 'sv-SE':['Fluxer genererar inte denna händelse ännu.','Omfattar bottar och privata communitykanaler.','Kopierad meddelandetext är synlig för alla som kan läsa loggkanalen. Källfiler arkiveras inte.'],
 th:['Fluxer ยังไม่สร้างเหตุการณ์นี้','รวมบอตและช่องส่วนตัวของชุมชน','ข้อความที่คัดลอกจะแสดงต่อทุกคนที่อ่านช่องบันทึกได้ ไฟล์ต้นฉบับจะไม่ถูกเก็บถาวร'],
 tr:['Fluxer henüz bu olayı üretmiyor.','Botları ve topluluğun özel kanallarını da kapsar.','Kopyalanan mesaj metni kayıt kanalını okuyabilen herkese görünür. Kaynak dosyalar arşivlenmez.'],
 uk:['Fluxer поки не створює цю подію.','Охоплює ботів і приватні канали спільноти.','Скопійований текст бачать усі, хто може читати канал журналів. Початкові файли не архівуються.'],
 vi:['Fluxer chưa tạo sự kiện này.','Bao gồm bot và các kênh riêng tư của cộng đồng.','Văn bản được sao chép hiển thị với mọi người có quyền đọc kênh nhật ký. Tệp gốc không được lưu trữ lại.'],
 'zh-CN':['Fluxer 尚未生成此事件。','包括机器人和社区的私密频道。','复制的消息文本对所有能读取日志频道的人可见。原始文件不会重新归档。'],
 'zh-TW':['Fluxer 尚未產生此事件。','包括機器人及社群的私人頻道。','複製的訊息文字對所有能讀取紀錄頻道的人可見。原始檔案不會重新封存。']};
const defs={};
const changedCopy={'en-US':'Changed','en-GB':'Changed',ar:'تم التغيير',bg:'Променено',cs:'Změněno',da:'Ændret',de:'Geändert',el:'Άλλαξε','es-ES':'Modificado','es-419':'Modificado',fi:'Muutettu',fr:'Modifié',he:'השתנה',hi:'बदला गया',hr:'Promijenjeno',hu:'Módosítva',id:'Diubah',it:'Modificato',ja:'変更されました',ko:'변경됨',lt:'Pakeista',nl:'Gewijzigd',no:'Endret',pl:'Zmieniono','pt-BR':'Alterado',ro:'Modificat',ru:'Изменено','sv-SE':'Ändrat',th:'เปลี่ยนแล้ว',tr:'Değiştirildi',uk:'Змінено',vi:'Đã thay đổi','zh-CN':'已更改','zh-TW':'已變更'};
const messageCopy={'en-US':'Message','en-GB':'Message',ar:'الرسالة',bg:'Съобщение',cs:'Zpráva',da:'Besked',de:'Nachricht',el:'Μήνυμα','es-ES':'Mensaje','es-419':'Mensaje',fi:'Viesti',fr:'Message',he:'הודעה',hi:'संदेश',hr:'Poruka',hu:'Üzenet',id:'Pesan',it:'Messaggio',ja:'メッセージ',ko:'메시지',lt:'Žinutė',nl:'Bericht',no:'Melding',pl:'Wiadomość','pt-BR':'Mensagem',ro:'Mesaj',ru:'Сообщение','sv-SE':'Meddelande',th:'ข้อความ',tr:'Mesaj',uk:'Повідомлення',vi:'Tin nhắn','zh-CN':'消息','zh-TW':'訊息'};
Object.assign(common, {logTitle:['netrcol.application_settings.module.logs.title'],none:['None'],message:['Message'],channel_text:['Text channel'],channel_voice:['Voice channel'],channel_category:['Category'],channel_announcement:['Announcement channel'],channel_link:['Channel','Link']});
// Reuse the native permission editor's translated names and mention placeholders.
const permissionSource=fs.readFileSync('fluxer_app/src/features/permissions/utils/PermissionLabelDescriptors.ts','utf8');
const permissionDescriptors=new Map([...permissionSource.matchAll(/const ([A-Z_]+) = msg\(\{\s*message: '([^']+)'/g)].map(match=>[match[1],match[2]]));
const permissionTitles=permissionSource.split('const PERMISSION_TITLE_DESCRIPTORS =')[1].split('const PERMISSION_DESCRIPTION_DESCRIPTORS =')[0];
for(const match of permissionTitles.matchAll(/\[Permissions\.([A-Z_]+), ([A-Z_]+)\]/g))common['permission_'+match[1]]=[permissionDescriptors.get(match[2])];
common.permission_MENTION_EVERYONE=['Use {everyoneMention}/{hereMention} and {rolesMention}'];
common.destination=['Channel'];
Object.assign(common,{status_online:['Online'],status_idle:['Idle'],status_dnd:['Do not disturb'],status_offline:['Offline']});
const reviewed=JSON.parse(fs.readFileSync('netrcol/i18n/event-log-labels.json','utf8'));
const phrases=JSON.parse(fs.readFileSync('netrcol/i18n/event-log-phrases.json','utf8'));
const testMarks={'en-US':'Test message','en-GB':'Test message',ar:'رسالة اختبار',bg:'Тестово съобщение',cs:'Testovací zpráva',da:'Testbesked',de:'Testnachricht',el:'Δοκιμαστικό μήνυμα','es-ES':'Mensaje de prueba','es-419':'Mensaje de prueba',fi:'Testiviesti',fr:'Message de test',he:'הודעת בדיקה',hi:'परीक्षण संदेश',hr:'Testna poruka',hu:'Tesztüzenet',id:'Pesan uji',it:'Messaggio di prova',ja:'テストメッセージ',ko:'테스트 메시지',lt:'Bandomoji žinutė',nl:'Testbericht',no:'Testmelding',pl:'Wiadomość testowa','pt-BR':'Mensagem de teste',ro:'Mesaj de test',ru:'Тестовое сообщение','sv-SE':'Testmeddelande',th:'ข้อความทดสอบ',tr:'Test mesajı',uk:'Тестове повідомлення',vi:'Tin nhắn thử nghiệm','zh-CN':'测试消息','zh-TW':'測試訊息'};
const reviewedKeys=['actor','target','before','after','capture','destination','voice_suppress','field_suppress'];
for(const e of entries)defs[e.id]={message:e.title,parts:pairs[e.id]};
for(const [id,parts]of Object.entries(categories))defs['category_'+id]={message:parts.join(' and '),parts};
for(const [id,parts]of Object.entries(common))defs[id]={message:parts.join(' '),parts};
for(const [id,label]of Object.entries(fields))defs['field_'+id]={message:label,parts:[label]};
for(const [i,id]of ['unavailable','scope','privacy'].entries())defs[id]={message:custom['en-US'][i],custom:i};
for(const [index,id]of reviewedKeys.entries())defs[id].message=reviewed['en-US'][index];
for(const [index,id]of phrases.keys.entries())defs[id].message=phrases.languages['en-US'][index];
defs.category_members.message='Membership and profile';
defs.category_integrations.message='Webhooks and expressions';
defs.category_voice.message='Voice and visible status';
defs.testMark.message=defs.field_test.message='Test message';
defs.logTitle.message='Event logs';
defs.changed={message:'Changed',parts:['Name']};
for(const def of Object.values(defs))if(def.parts)def.parts=def.parts.map(key);
write('fluxer_app/src/features/application_settings/EventLogCatalogCopy.ts',`// SPDX-License-Identifier: AGPL-3.0-or-later\nimport {msg} from '@lingui/core/macro';\nexport const EVENT_LOG_LABELS = {\n${Object.entries(defs).map(([id,d])=>`\t${JSON.stringify(id)}: msg({id: 'netrcol.application_settings.logCatalog.${id}', message: ${JSON.stringify(d.message)}}),`).join('\n')}\n};\n`);
const translations={};
for(const locale of fs.readdirSync(root)){
 const poPath=`${root}/${locale}/messages.po`;if(!fs.existsSync(poPath))continue;
 const po=fs.readFileSync(poPath,'utf8'), map=parse(po), copy={};
 const translate=s=>{if(s==='ID')return 'ID';const v=map.get(s);if(!v)throw Error(`${locale}: missing ${s}`);return v;};
 for(const [id,d]of Object.entries(defs))copy[id]=locale.startsWith('en-')?d.message:d.custom!==undefined?(custom[locale==='es-419'?'es-ES':locale][d.custom]):native.has(d.message)?translate(d.message):d.parts.map(translate).join(' · ');
 copy.member_join=translate('netrcol.application_settings.logs.memberJoin');
 copy.member_leave=translate('netrcol.application_settings.logs.memberLeave');
 for(const [index,id]of reviewedKeys.entries())copy[id]=reviewed[locale][index];
 if(phrases.languages[locale]?.length!==phrases.keys.length)throw Error(locale+': incomplete precise event phrases');
 for(const [index,id]of phrases.keys.entries())copy[id]=phrases.languages[locale][index];
 if(!testMarks[locale])throw Error('Missing test label '+locale);
 copy.testMark=copy.field_test=testMarks[locale];
 if(!changedCopy[locale])throw Error('Missing change label '+locale);
 copy.changed=changedCopy[locale];
 if(!messageCopy[locale])throw Error('Missing message label '+locale);
 copy.message=copy.field_content=messageCopy[locale];
 for(const id of ['field_splash_width','field_embed_splash_width'])copy[id]=copy.field_banner_width;
 for(const id of ['field_splash_height','field_embed_splash_height'])copy[id]=copy.field_banner_height;
 if(locale==='tr'){
  for(const event of entries){if(!phrases.turkishEvents[event.id])throw Error('Missing Turkish event '+event.id);copy[event.id]=phrases.turkishEvents[event.id];}
  Object.assign(copy,{category_members:'Üyelik ve profil',category_channels:'Kanallar ve kategoriler',category_integrations:'Webhook’lar ve ifadeler',category_voice:'Ses ve görünen durum'});
 }
 translations[locale]=copy;
 const active=po.split(/\r?\n\r?\n/).filter(block=>!/^msgid "netrcol\.application_settings\.logCatalog\./m.test(block));
 for(const [id,translation]of Object.entries(copy))active.push(`#. js-lingui-explicit-id\nmsgid ${JSON.stringify('netrcol.application_settings.logCatalog.'+id)}\nmsgstr ${JSON.stringify(translation)}`);
 if(check){for(const [id,value] of Object.entries(copy))if(map.get('netrcol.application_settings.logCatalog.'+id)!==value)throw Error(locale+': '+id);}else write(poPath,active.join('\n\n').trimEnd()+'\n');
}
write('packages/constants/src/EventLogTranslations.ts',`// SPDX-License-Identifier: AGPL-3.0-or-later\n// Generated from Fluxer's native locale catalogs and reviewed event-log copy.\nexport const EVENT_LOG_TRANSLATIONS: Record<string, Record<string, string>> = ${JSON.stringify(translations,null,2)};\n`);
write('netrcol/i18n/event-logs.json',JSON.stringify(translations,null,2)+'\n');
console.log('Generated '+Object.keys(defs).length+' event/field/UI labels in '+Object.keys(translations).length+' languages.');
