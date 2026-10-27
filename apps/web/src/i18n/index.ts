import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  en: {
    translation: {
      nav: { overview: "Overview", brands: "Brand profiles", audits: "Compliance audits", reports: "Reports", analytics: "Analytics & growth", assistant: "AI assistant", surveys: "Surveys & feedback", community: "Community", rewards: "Rewards", settings: "Settings" },
      common: { search: "Search", notifications: "Notifications", help: "Help center", demo: "Demo data", live: "Live mode", english: "English", hindi: "हिन्दी", signIn: "Sign in", signOut: "Sign out", createAccount: "Create account", learnMore: "Learn more", openWorkspace: "Open workspace" },
      home: { eyebrow: "Brand protection, with evidence", title: "Turn brand rules into decisions.", body: "BrandSentinel AI helps teams audit every message, understand risk, and keep every campaign unmistakably theirs.", primary: "Enter the control room", secondary: "See how it works", proof: "Built for the moment before publish", metric: "58", metricLabel: "sample compliance score", sample: "Our new serum is the #1 cure for acne — guaranteed results in 7 days!!" },
      auth: { loginTitle: "Welcome back", loginBody: "Sign in to review what your brand is saying.", registerTitle: "Build your brand workspace", registerBody: "Start with a workspace, then turn your guidelines into an active policy.", email: "Work email", password: "Password", name: "Your name", submitLogin: "Sign in", submitRegister: "Create workspace account", forgot: "Forgot password?", noAccount: "New to BrandSentinel?", haveAccount: "Already have an account?", resetTitle: "Reset your password", resetBody: "We’ll send a secure reset link to your inbox.", sendReset: "Send reset link" },
      overview: { eyebrow: "Workspace overview", title: "Good morning, brand team.", body: "A focused view of what needs review before your next campaign ships.", score: "Compliance score", audits: "Audits this month", findings: "Open findings", active: "Active brands", trend: "Score trend", recent: "Recent audit activity", next: "Next best actions", action1: "Approve your first guideline version", action2: "Run a sample audit", action3: "Invite a workspace member" },
    },
  },
  hi: {
    translation: {
      nav: { overview: "अवलोकन", brands: "ब्रांड प्रोफ़ाइल", audits: "अनुपालन ऑडिट", reports: "रिपोर्ट", analytics: "एनालिटिक्स और ग्रोथ", assistant: "AI सहायक", surveys: "सर्वे और प्रतिक्रिया", community: "समुदाय", rewards: "रिवॉर्ड्स", settings: "सेटिंग्स" },
      common: { search: "खोजें", notifications: "सूचनाएँ", help: "सहायता केंद्र", demo: "डेमो डेटा", live: "लाइव मोड", english: "English", hindi: "हिन्दी", signIn: "साइन इन", signOut: "साइन आउट", createAccount: "खाता बनाएँ", learnMore: "और जानें", openWorkspace: "वर्कस्पेस खोलें" },
      home: { eyebrow: "सबूत के साथ ब्रांड सुरक्षा", title: "ब्रांड नियमों को निर्णयों में बदलें।", body: "BrandSentinel AI टीमों को हर संदेश का ऑडिट करने, जोखिम समझने और हर अभियान को अपने ब्रांड के अनुरूप रखने में मदद करता है।", primary: "कंट्रोल रूम खोलें", secondary: "जानें कैसे काम करता है", proof: "पब्लिश से पहले सही क्षण के लिए", metric: "58", metricLabel: "सैंपल अनुपालन स्कोर", sample: "हमारा नया सीरम मुहाँसों का #1 इलाज है — 7 दिनों में गारंटी परिणाम!!" },
      auth: { loginTitle: "वापसी पर स्वागत है", loginBody: "यह देखने के लिए साइन इन करें कि आपका ब्रांड क्या कह रहा है।", registerTitle: "अपना ब्रांड वर्कस्पेस बनाएँ", registerBody: "वर्कस्पेस से शुरू करें और अपने दिशानिर्देशों को सक्रिय नीति में बदलें।", email: "कार्य ईमेल", password: "पासवर्ड", name: "आपका नाम", submitLogin: "साइन इन", submitRegister: "वर्कस्पेस खाता बनाएँ", forgot: "पासवर्ड भूल गए?", noAccount: "BrandSentinel में नए हैं?", haveAccount: "पहले से खाता है?", resetTitle: "पासवर्ड रीसेट करें", resetBody: "हम आपके इनबॉक्स में सुरक्षित रीसेट लिंक भेजेंगे।", sendReset: "रीसेट लिंक भेजें" },
      overview: { eyebrow: "वर्कस्पेस अवलोकन", title: "सुप्रभात, ब्रांड टीम।", body: "आपके अगले अभियान से पहले समीक्षा की ज़रूरत वाली चीज़ों का केंद्रित दृश्य।", score: "अनुपालन स्कोर", audits: "इस महीने के ऑडिट", findings: "खुले निष्कर्ष", active: "सक्रिय ब्रांड", trend: "स्कोर ट्रेंड", recent: "हाल की ऑडिट गतिविधि", next: "अगले बेहतर कदम", action1: "पहला दिशानिर्देश संस्करण स्वीकृत करें", action2: "सैंपल ऑडिट चलाएँ", action3: "वर्कस्पेस सदस्य को आमंत्रित करें" },
    },
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: localStorage.getItem("brandsentinel-language") ?? "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

i18n.on("languageChanged", (language) => localStorage.setItem("brandsentinel-language", language));
export default i18n;
