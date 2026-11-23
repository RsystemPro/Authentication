import { authMessages } from '@/features/auth/i18n/messages'

export const resources = {
  en: {
    translation: {
      auth: authMessages.en,
      app: { name: 'ViraBoard', tagline: 'Space to think together' },
      nav: {
        dashboard: 'Workspace',
        settings: 'Settings',
        label: 'Main navigation',
        skip: 'Skip to content',
      },
      common: {
        loading: 'Loading…',
        home: 'Back to workspace',
        reload: 'Reload page',
      },
      dashboard: {
        eyebrow: 'YOUR WORKSPACE',
        title: 'Good ideas start together.',
        description:
          'A place to learn, share ideas, and make room for your next big thought.',
        preferences: 'Make it yours',
        rooms: 'Your rooms',
        emptyTitle: 'A little space for your next idea',
        emptyDescription:
          'Your rooms will live here. Room creation and live collaboration are coming in a future update.',
        boardTitle: 'Think visually',
        boardDescription:
          'A shared canvas for ideas, sketches, and the bigger picture.',
        learnTitle: 'Learn together',
        learnDescription:
          'Bring people into one space for lessons and conversation.',
        connectTitle: 'Stay connected',
        connectDescription:
          'Make collaboration feel natural, wherever you are.',
      },
      settings: {
        title: 'Make yourself at home',
        description:
          'Choose how your workspace looks and feels. Your preferences are saved on this browser.',
        appearance: 'Appearance',
        theme: 'Theme',
        system: 'Use device setting',
        light: 'Light',
        dark: 'Dark',
        language: 'Language',
        languageDescription:
          'The layout adjusts automatically for your language.',
      },
      errors: {
        title: 'Something went wrong',
        description: 'The page could not be displayed. Reload to try again.',
        notFound: 'This page is not here',
        notFoundDescription:
          'The address may have changed. Return to your workspace to continue.',
      },
    },
  },
  fa: {
    translation: {
      auth: authMessages.fa,
      app: { name: 'ویرابورد', tagline: 'فضایی برای با هم فکر کردن' },
      nav: {
        dashboard: 'فضای کار',
        settings: 'تنظیمات',
        label: 'ناوبری اصلی',
        skip: 'رفتن به محتوا',
      },
      common: {
        loading: 'در حال بارگذاری…',
        home: 'بازگشت به فضای کار',
        reload: 'بارگذاری دوباره',
      },
      dashboard: {
        eyebrow: 'فضای کار شما',
        title: 'ایده‌های خوب، با هم شروع می‌شوند.',
        description:
          'جایی برای یادگیری، به اشتراک گذاشتن ایده‌ها و شکل دادن به فکرهای تازه.',
        preferences: 'به سلیقه خودت',
        rooms: 'اتاق‌های شما',
        emptyTitle: 'فضایی برای ایده بعدی شما',
        emptyDescription:
          'اتاق‌های شما اینجا نمایش داده می‌شوند. ساخت اتاق و همکاری زنده در به‌روزرسانی‌های بعدی اضافه خواهند شد.',
        boardTitle: 'تصویری فکر کنید',
        boardDescription:
          'بومی مشترک برای ایده‌ها، طرح‌ها و دیدن تصویر بزرگ‌تر.',
        learnTitle: 'با هم یاد بگیرید',
        learnDescription: 'فضایی مشترک برای آموزش، گفتگو و تبادل نظر.',
        connectTitle: 'در ارتباط بمانید',
        connectDescription: 'همکاری ساده و نزدیک، از هر جایی که هستید.',
      },
      settings: {
        title: 'اینجا را به سلیقه خودتان بسازید',
        description:
          'ظاهر و زبان فضای کار را انتخاب کنید. تنظیمات شما در همین مرورگر ذخیره می‌شوند.',
        appearance: 'ظاهر',
        theme: 'پوسته',
        system: 'هماهنگ با دستگاه',
        light: 'روشن',
        dark: 'تیره',
        language: 'زبان',
        languageDescription: 'چیدمان به صورت خودکار با زبان شما هماهنگ می‌شود.',
      },
      errors: {
        title: 'مشکلی پیش آمد',
        description: 'نمایش صفحه امکان‌پذیر نیست. دوباره بارگذاری کنید.',
        notFound: 'این صفحه پیدا نشد',
        notFoundDescription:
          'ممکن است نشانی تغییر کرده باشد. برای ادامه به فضای کار برگردید.',
      },
    },
  },
} as const
