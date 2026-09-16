/**
 * Locales for the playground's language switch.
 *
 * `<RecallIntl locale="ja">` on its own already localises every *number* the
 * components render. "3d" becomes "3日" through `Intl`, with no translation
 * table. The `strings` below are the other half: the fixed labels, which the
 * library deliberately does not ship translations for.
 *
 * Partial objects on purpose. Anything omitted falls back to English rather
 * than rendering blank, which is the behaviour worth showing off.
 */

export interface DemoLocale {
  tag: string;
  /** Shown on the switch, in the language itself. */
  label: string;
  strings?: Record<string, unknown>;
}

export const LOCALES: DemoLocale[] = [
  { tag: 'en', label: 'English' },
  {
    tag: 'fr',
    label: 'Français',
    strings: {
      showAnswer: 'Voir la réponse',
      skip: 'Passer',
      studyAgain: 'Réviser encore',
      loading: 'Chargement…',
      nothingDue: 'Rien à réviser pour le moment.',
      relearningWait: 'Bien joué, une carte revient dans un instant.',
      progress: 'Progression de la séance',
      rateYourRecall: 'Évaluez votre mémorisation',
      couldNotLoad: 'Impossible de charger votre progression.',
      retry: 'Réessayer',
      stats: {
        dueNow: 'À réviser',
        dueToday: "Aujourd'hui",
        totalCards: 'Cartes',
        retention: 'Rétention',
        streak: 'Série',
      },
      qualities: {
        0: 'Oublié',
        1: 'Encore',
        2: 'Faux',
        3: 'Difficile',
        4: 'Correct',
        5: 'Facile',
      },
    },
  },
  {
    tag: 'ja',
    label: '日本語',
    strings: {
      showAnswer: '答えを見る',
      skip: 'スキップ',
      studyAgain: 'もう一度学習',
      loading: '読み込み中…',
      nothingDue: '今は復習するカードがありません。',
      relearningWait: 'お疲れさま。もうすぐ 1 枚戻ってきます。',
      progress: 'セッションの進捗',
      rateYourRecall: '記憶度を評価',
      couldNotLoad: '進捗を読み込めませんでした。',
      retry: '再試行',
      stats: {
        dueNow: '今すぐ',
        dueToday: '今日',
        totalCards: 'カード数',
        retention: '定着率',
        streak: '連続日数',
      },
      qualities: {
        0: '完全に忘れた',
        1: 'もう一度',
        2: '不正解',
        3: '難しい',
        4: '普通',
        5: '簡単',
      },
    },
  },
];

export function localeFor(tag: string): DemoLocale {
  return LOCALES.find((locale) => locale.tag === tag) ?? LOCALES[0]!;
}
