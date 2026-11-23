export const authMessages = {
  en: {
    titles: {
      login: 'Sign in',
      register: 'Create account',
      'forgot-password': 'Forgot password',
      'resend-verification': 'Resend verification email',
      'verify-email': 'Verify email',
      'reset-password': 'Reset password',
    },
    introduction: 'Welcome to your shared workspace.',
    confirmAction:
      'Confirm below to use this email link. Opening the link does not change your account.',
    email: 'Email',
    password: 'Password',
    newPassword: 'New password',
    confirmPassword: 'Confirm password',
    emailRule: 'Enter a valid email address.',
    passwordRule: 'Use 15–128 characters.',
    passwordRequired: 'Enter your password (up to 128 characters).',
    passwordMismatch: 'The passwords do not match.',
    passwordHint:
      'Choose a unique passphrase. Common or compromised passwords are rejected.',
    emailSent:
      'If this address is eligible, instructions will be sent. Check your inbox and spam folder. Verify your email before signing in.',
    actionComplete:
      'Done. You can now sign in. After a password reset, all devices must sign in again.',
    invalidLink:
      'This link is missing or invalid. Open the full link from your email, or request a new one.',
    navigation: 'Account navigation',
    account: 'Account & security',
    profile: 'Your account',
    logout: 'Sign out',
    logoutAll: 'Sign out all devices',
    logoutAllConfirm: 'Sign out all devices, including this one?',
    logoutFailed:
      'Sign out could not be confirmed. You are still signed in. Please try again.',
    changePassword: 'Change password',
    passwordChangeHint:
      'Changing your password signs out all devices. You will need to sign in again.',
    sessions: 'Active sessions',
    currentDevice: 'This device',
    unknownDevice: 'Unknown device',
    lastActive: 'Last active',
    revoke: 'Revoke',
    revokeConfirm:
      'Revoke this session? This device will need to sign in again.',
    noSessions: 'No active sessions.',
    retry: 'Try again',
    refresh: 'Refresh',
    previous: 'Previous',
    next: 'Next',
    errors: {
      credentials:
        'Check your email and password, and make sure your email is verified. Your session may also have expired.',
      invalid:
        'Check your details. Email links may have expired or already been used; new passwords must be unique and 15–128 characters.',
      origin:
        'The server did not accept this site. Check the allowed frontend origin and cookie settings.',
      rateLimit: 'Too many attempts. Wait a while before trying again.',
      unavailable:
        'The service could not be reached. Check your connection and try again.',
      coordination:
        'Secure sign-in requires a current browser with Web Locks and BroadcastChannel. Open this site over HTTPS or localhost.',
    },
  },
  fa: {
    titles: {
      login: 'ورود',
      register: 'ساخت حساب',
      'forgot-password': 'فراموشی رمز عبور',
      'resend-verification': 'ارسال دوباره ایمیل تأیید',
      'verify-email': 'تأیید ایمیل',
      'reset-password': 'بازنشانی رمز عبور',
    },
    introduction: 'به فضای کار مشترک خود خوش آمدید.',
    confirmAction:
      'برای استفاده از لینک ایمیل، دکمه زیر را بزنید. باز کردن لینک به‌تنهایی حساب شما را تغییر نمی‌دهد.',
    email: 'ایمیل',
    password: 'رمز عبور',
    newPassword: 'رمز عبور جدید',
    confirmPassword: 'تکرار رمز عبور',
    emailRule: 'یک نشانی ایمیل معتبر وارد کنید.',
    passwordRule: 'از ۱۵ تا ۱۲۸ نویسه استفاده کنید.',
    passwordRequired: 'رمز عبور خود را وارد کنید (حداکثر ۱۲۸ نویسه).',
    passwordMismatch: 'رمزهای عبور یکسان نیستند.',
    passwordHint:
      'یک عبارت عبور منحصربه‌فرد انتخاب کنید. رمزهای رایج یا افشاشده پذیرفته نمی‌شوند.',
    emailSent:
      'اگر این نشانی واجد شرایط باشد، راهنما ارسال می‌شود. صندوق ورودی و پوشه هرزنامه را بررسی کنید. پیش از ورود، ایمیل را تأیید کنید.',
    actionComplete:
      'انجام شد. اکنون می‌توانید وارد شوید. پس از بازنشانی رمز عبور، همه دستگاه‌ها باید دوباره وارد شوند.',
    invalidLink:
      'لینک وجود ندارد یا نامعتبر است. لینک کامل ایمیل را باز کنید یا لینک جدیدی بخواهید.',
    navigation: 'ناوبری حساب',
    account: 'حساب و امنیت',
    profile: 'حساب شما',
    logout: 'خروج',
    logoutAll: 'خروج از همه دستگاه‌ها',
    logoutAllConfirm: 'از همه دستگاه‌ها، از جمله این دستگاه، خارج می‌شوید؟',
    logoutFailed: 'خروج تأیید نشد و همچنان وارد حساب هستید. دوباره تلاش کنید.',
    changePassword: 'تغییر رمز عبور',
    passwordChangeHint:
      'با تغییر رمز عبور، همه دستگاه‌ها خارج می‌شوند و باید دوباره وارد شوید.',
    sessions: 'نشست‌های فعال',
    currentDevice: 'این دستگاه',
    unknownDevice: 'دستگاه ناشناس',
    lastActive: 'آخرین فعالیت',
    revoke: 'لغو نشست',
    revokeConfirm: 'این نشست لغو شود؟ این دستگاه باید دوباره وارد شود.',
    noSessions: 'نشست فعالی وجود ندارد.',
    retry: 'تلاش دوباره',
    refresh: 'به‌روزرسانی',
    previous: 'قبلی',
    next: 'بعدی',
    errors: {
      credentials:
        'ایمیل و رمز عبور و تأیید شدن ایمیل را بررسی کنید. ممکن است نشست شما نیز منقضی شده باشد.',
      invalid:
        'اطلاعات را بررسی کنید. لینک ایمیل ممکن است منقضی یا استفاده شده باشد؛ رمز جدید باید منحصربه‌فرد و بین ۱۵ تا ۱۲۸ نویسه باشد.',
      origin:
        'سرور این سایت را نپذیرفت. مبدأ مجاز فرانت‌اند و تنظیمات کوکی را بررسی کنید.',
      rateLimit: 'تعداد تلاش‌ها زیاد است. کمی صبر کنید و دوباره تلاش کنید.',
      unavailable:
        'ارتباط با سرویس برقرار نشد. اتصال خود را بررسی و دوباره تلاش کنید.',
      coordination:
        'ورود امن به مرورگر به‌روز با پشتیبانی Web Locks و BroadcastChannel نیاز دارد. سایت را با HTTPS یا localhost باز کنید.',
    },
  },
} as const
