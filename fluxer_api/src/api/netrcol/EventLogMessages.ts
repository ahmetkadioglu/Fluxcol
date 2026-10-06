// SPDX-License-Identifier: AGPL-3.0-or-later

// Deliberately contains no mention syntax, member names or private message content.
const COPY: Record<string, readonly [string, string, string]> = {
	ar: ['انضم عضو', 'غادر عضو', 'اختبار سجل الأحداث'],
	bg: ['Член се присъедини', 'Член напусна', 'Тест на дневника на събитията'],
	cs: ['Člen se připojil', 'Člen odešel', 'Test záznamů událostí'],
	da: ['Et medlem tilsluttede sig', 'Et medlem forlod fællesskabet', 'Test af hændelseslog'],
	de: ['Mitglied beigetreten', 'Mitglied ausgetreten', 'Test des Ereignisprotokolls'],
	el: ['Ένα μέλος συνδέθηκε', 'Ένα μέλος αποχώρησε', 'Δοκιμή αρχείου συμβάντων'],
	'en-US': ['Member joined', 'Member left', 'Event log test'],
	'en-GB': ['Member joined', 'Member left', 'Event log test'],
	'es-ES': ['Un miembro se ha unido', 'Un miembro ha salido', 'Prueba del registro de eventos'],
	'es-419': ['Un miembro se unió', 'Un miembro salió', 'Prueba del registro de eventos'],
	fi: ['Jäsen liittyi', 'Jäsen poistui', 'Tapahtumalokin testi'],
	fr: ['Un membre a rejoint la communauté', 'Un membre a quitté la communauté', 'Test du journal des événements'],
	he: ['חבר הצטרף', 'חבר עזב', 'בדיקת יומן אירועים'],
	hi: ['सदस्य शामिल हुआ', 'सदस्य चला गया', 'ईवेंट लॉग का परीक्षण'],
	hr: ['Član se pridružio', 'Član je napustio zajednicu', 'Test zapisnika događaja'],
	hu: ['Egy tag csatlakozott', 'Egy tag távozott', 'Eseménynapló tesztje'],
	id: ['Anggota bergabung', 'Anggota keluar', 'Uji log peristiwa'],
	it: ['Un membro è entrato', 'Un membro è uscito', 'Test del registro eventi'],
	ja: ['メンバーが参加しました', 'メンバーが退出しました', 'イベントログのテスト'],
	ko: ['멤버가 참가했습니다', '멤버가 나갔습니다', '이벤트 로그 테스트'],
	lt: ['Narys prisijungė', 'Narys išėjo', 'Įvykių žurnalo bandymas'],
	nl: ['Lid toegetreden', 'Lid vertrokken', 'Test van het gebeurtenislogboek'],
	no: ['Et medlem ble med', 'Et medlem forlot fellesskapet', 'Test av hendelseslogg'],
	pl: ['Członek dołączył', 'Członek opuścił społeczność', 'Test dziennika zdarzeń'],
	'pt-BR': ['Um membro entrou', 'Um membro saiu', 'Teste do registro de eventos'],
	ro: ['Un membru s-a alăturat', 'Un membru a plecat', 'Test al jurnalului de evenimente'],
	ru: ['Участник присоединился', 'Участник вышел', 'Проверка журнала событий'],
	'sv-SE': ['En medlem gick med', 'En medlem lämnade', 'Test av händelseloggen'],
	th: ['สมาชิกเข้าร่วม', 'สมาชิกออกจากชุมชน', 'ทดสอบบันทึกเหตุการณ์'],
	tr: ['Üye katıldı', 'Üye ayrıldı', 'Olay kayıtları testi'],
	uk: ['Учасник приєднався', 'Учасник вийшов', 'Перевірка журналу подій'],
	vi: ['Thành viên đã tham gia', 'Thành viên đã rời đi', 'Kiểm tra nhật ký sự kiện'],
	'zh-CN': ['成员已加入', '成员已离开', '事件日志测试'],
	'zh-TW': ['成員已加入', '成員已離開', '事件紀錄測試'],
};

export function eventLogMessage(
	kind: 'member_join' | 'member_leave' | 'test',
	language: string,
	userId: string,
	occurredAt: number,
): string {
	const copy = COPY[language] ?? COPY['en-US'];
	const heading = copy[kind === 'member_join' ? 0 : kind === 'member_leave' ? 1 : 2];
	return `**${heading}** · \`${userId}\`\n${new Date(occurredAt).toISOString()}`;
}
