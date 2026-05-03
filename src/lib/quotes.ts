export interface Quote {
  text: string;
  author: string;
  isArabic?: boolean;
}

export const quotes: Quote[] = [
  // English quotes
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Learning never exhausts the mind.", author: "Leonardo da Vinci" },
  { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Education is not preparation for life; education is life itself.", author: "John Dewey" },
  { text: "The beautiful thing about learning is that nobody can take it away from you.", author: "B.B. King" },
  { text: "Study hard what interests you the most in the most undisciplined way.", author: "Richard Feynman" },
  { text: "The expert in anything was once a beginner.", author: "Helen Hayes" },
  { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
  { text: "The more that you read, the more things you will know.", author: "Dr. Seuss" },
  { text: "Live as if you were to die tomorrow. Learn as if you were to live forever.", author: "Mahatma Gandhi" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
  { text: "The mind is not a vessel to be filled, but a fire to be kindled.", author: "Plutarch" },
  { text: "Knowledge is power. Information is liberating.", author: "Kofi Annan" },
  { text: "The capacity to learn is a gift; the ability to learn is a skill; the willingness to learn is a choice.", author: "Brian Herbert" },
  { text: "Tell me and I forget. Teach me and I remember. Involve me and I learn.", author: "Benjamin Franklin" },
  { text: "Wisdom is not a product of schooling but of the lifelong attempt to acquire it.", author: "Albert Einstein" },
  { text: "The roots of education are bitter, but the fruit is sweet.", author: "Aristotle" },
  { text: "Anyone who stops learning is old, whether at twenty or eighty.", author: "Henry Ford" },
  { text: "The only true wisdom is in knowing you know nothing.", author: "Socrates" },
  { text: "Develop a passion for learning. If you do, you will never cease to grow.", author: "Anthony J. D'Angelo" },
  { text: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela" },
  { text: "Learning is a treasure that will follow its owner everywhere.", author: "Chinese Proverb" },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "What we learn with pleasure we never forget.", author: "Alfred Mercier" },
  { text: "Motivation is what gets you started. Habit is what keeps you going.", author: "Jim Ryun" },
  { text: "Medicine is a science of uncertainty and an art of probability.", author: "William Osler" },
  { text: "The good physician treats the disease; the great physician treats the patient.", author: "William Osler" },
  { text: "Wherever the art of medicine is loved, there is also a love of humanity.", author: "Hippocrates" },
  
  // Arabic quotes
  { text: "اطلبوا العلم من المهد إلى اللحد", author: "حديث شريف", isArabic: true },
  { text: "العلم نور والجهل ظلام", author: "مثل عربي", isArabic: true },
  { text: "من جدّ وجد، ومن زرع حصد", author: "مثل عربي", isArabic: true },
  { text: "العلم في الصغر كالنقش على الحجر", author: "مثل عربي", isArabic: true },
  { text: "إذا لم تزد شيئاً على الدنيا كنت أنت زائداً عليها", author: "مصطفى صادق الرافعي", isArabic: true },
  { text: "ليس الفخر في أن تقهر قوياً، بل الفخر أن تنصف ضعيفاً", author: "جبران خليل جبران", isArabic: true },
  { text: "من طلب العلا سهر الليالي", author: "مثل عربي", isArabic: true },
  { text: "الصبر مفتاح الفرج", author: "مثل عربي", isArabic: true },
  { text: "رحلة الألف ميل تبدأ بخطوة واحدة", author: "لاوتزو", isArabic: true },
  { text: "لا تؤجل عمل اليوم إلى الغد", author: "مثل عربي", isArabic: true },
  { text: "خير جليس في الزمان كتاب", author: "المتنبي", isArabic: true },
  { text: "العقل السليم في الجسم السليم", author: "مثل عربي", isArabic: true },
  { text: "إنما الأمم الأخلاق ما بقيت، فإن هُمُ ذهبت أخلاقهم ذهبوا", author: "أحمد شوقي", isArabic: true },
  { text: "كن عالماً أو متعلماً أو مستمعاً أو محباً، ولا تكن الخامسة فتهلك", author: "حديث شريف", isArabic: true },
  { text: "التعليم هو السلاح الأقوى الذي يمكنك استخدامه لتغيير العالم", author: "نيلسون مانديلا", isArabic: true },
];
