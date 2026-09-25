/**
 * quotes.js
 * A pool of 32 welcoming quotes shown one at a time on the home screen.
 * Every visit picks a fresh random quote — see js/main.js -> showRandomQuote().
 * Add more anytime: just add another { en: "...", ml: "..." } object to the array.
 */

const QUOTES = [
  { en: "Every voice in this campus matters, and every concern deserves an answer.", ml: "ഈ ക്യാമ്പസിലെ ഓരോ ശബ്ദവും പ്രധാനമാണ്, ഓരോ പരാതിക്കും ഒരു മറുപടി അർഹതയുണ്ട്." },
  { en: "A small complaint heard today prevents a bigger problem tomorrow.", ml: "ഇന്ന് കേൾക്കുന്ന ഒരു ചെറിയ പരാതി നാളെ വലിയൊരു പ്രശ്നം തടയുന്നു." },
  { en: "Good institutions are built on students who care enough to speak up.", ml: "സംസാരിക്കാൻ ധൈര്യമുള്ള വിദ്യാർത്ഥികളിലാണ് നല്ല സ്ഥാപനങ്ങൾ കെട്ടിപ്പടുക്കുന്നത്." },
  { en: "Your feedback is not a complaint, it is a contribution.", ml: "നിങ്ങളുടെ അഭിപ്രായം ഒരു പരാതി അല്ല, അതൊരു സംഭാവനയാണ്." },
  { en: "We grow stronger every time a student trusts us with a problem.", ml: "ഒരു വിദ്യാർത്ഥി ഒരു പ്രശ്നം ഞങ്ങളെ വിശ്വസിച്ച് ഏൽപ്പിക്കുമ്പോഴെല്ലാം ഞങ്ങൾ കൂടുതൽ ശക്തരാകുന്നു." },
  { en: "Change begins the moment someone decides to say something.", ml: "ആരെങ്കിലും എന്തെങ്കിലും പറയാൻ തീരുമാനിക്കുന്ന നിമിഷം മുതൽ മാറ്റം ആരംഭിക്കുന്നു." },
  { en: "This exists because your experience here matters.", ml: "ഇത് നിലനിൽക്കുന്നത് നിങ്ങളുടെ അനുഭവം ഇവിടെ പ്രധാനമായതുകൊണ്ടാണ്." },
  { en: "A campus that listens is a campus that keeps improving.", ml: "കേൾക്കുന്ന ഒരു ക്യാമ്പസ് നിരന്തരം മെച്ചപ്പെടുന്ന ഒരു ക്യാമ്പസാണ്." },
  { en: "Honesty from students is the shortest path to a better school.", ml: "വിദ്യാർത്ഥികളുടെ സത്യസന്ധതയാണ് മികച്ച ഒരു വിദ്യാലയത്തിലേക്കുള്ള ഏറ്റവും ചെറിയ വഴി." },
  { en: "No concern is too small to be written down and looked into.", ml: "എഴുതി പരിശോധിക്കാൻ ഒരു ആശങ്കയും വളരെ ചെറുതല്ല." },
  { en: "Every message here is read by someone who is ready to act.", ml: "ഇവിടെ വരുന്ന ഓരോ സന്ദേശവും പ്രവർത്തിക്കാൻ തയ്യാറായ ഒരാൾ വായിക്കുന്നു." },
  { en: "Speaking up today is how tomorrow's students inherit a fairer place.", ml: "ഇന്ന് സംസാരിക്കുന്നത് നാളത്തെ വിദ്യാർത്ഥികൾക്ക് കൂടുതൽ നീതിയുള്ള ഒരിടം നൽകും." },
  { en: "We would rather fix a small issue now than a big one later.", ml: "പിന്നീട് വലുതാകുന്നതിന് മുൻപ് ചെറിയ പ്രശ്നങ്ങൾ ഇപ്പോൾ തന്നെ പരിഹരിക്കാൻ ഞങ്ങൾ ആഗ്രഹിക്കുന്നു." },
  { en: "Being heard is the first step to being helped.", ml: "കേൾക്കപ്പെടുക എന്നത് സഹായം ലഭിക്കാനുള്ള ആദ്യ പടിയാണ്." },
  { en: "This is a place for students to be honest, not just polite.", ml: "മര്യാദ മാത്രമല്ല, സത്യസന്ധത കൂടി കാണിക്കാനുള്ള ഇടമാണിത്." },
  { en: "Great leaders are built by the questions they choose to answer.", ml: "മറുപടി നൽകാൻ തിരഞ്ഞെടുക്കുന്ന ചോദ്യങ്ങളാണ് മികച്ച നേതാക്കളെ വാർത്തെടുക്കുന്നത്." },
  { en: "We believe transparency is the most respectful thing we can offer you.", ml: "സുതാര്യതയാണ് ഞങ്ങൾക്ക് നിങ്ങൾക്ക് നൽകാൻ കഴിയുന്ന ഏറ്റവും ആദരവുള്ള കാര്യം." },
  { en: "Your name on a complaint form is an act of trust, and we take it seriously.", ml: "പരാതി ഫോമിലെ നിങ്ങളുടെ പേര് ഒരു വിശ്വാസത്തിന്റെ പ്രവൃത്തിയാണ്, ഞങ്ങൾ അത് ഗൗരവമായി എടുക്കുന്നു." },
  { en: "The best campuses are the ones still willing to be corrected.", ml: "തിരുത്താൻ ഇപ്പോഴും തയ്യാറുള്ള ക്യാമ്പസുകളാണ് ഏറ്റവും മികച്ചത്." },
  { en: "A single message can start a fund, a repair, or a new rule.", ml: "ഒരൊറ്റ സന്ദേശത്തിന് ഒരു ഫണ്ട്, ഒരു അറ്റകുറ്റപ്പണി, അല്ലെങ്കിൽ ഒരു പുതിയ നിയമം തുടങ്ങാൻ കഴിയും." },
  { en: "You are not just a student here, you are a stakeholder in this place.", ml: "നിങ്ങൾ ഇവിടെ ഒരു വിദ്യാർത്ഥി മാത്രമല്ല, ഈ സ്ഥലത്തിന്റെ ഒരു പങ്കാളി കൂടിയാണ്." },
  { en: "It takes one honest word to open a door that was stuck for years.", ml: "വർഷങ്ങളായി അടഞ്ഞുകിടന്ന ഒരു വാതിൽ തുറക്കാൻ ഒരു സത്യസന്ധമായ വാക്ക് മതി." },
  { en: "We would rather hear it from you than hear about it later.", ml: "പിന്നീട് അതിനെക്കുറിച്ച് കേൾക്കുന്നതിനേക്കാൾ നിങ്ങളിൽ നിന്ന് നേരിട്ട് കേൾക്കാനാണ് ഞങ്ങൾ ആഗ്രഹിക്കുന്നത്." },
  { en: "Fairness is built one heard complaint at a time.", ml: "ഒരു സമയം ഒരു പരാതി കേട്ടുകൊണ്ടാണ് നീതി കെട്ടിപ്പടുക്കുന്നത്." },
  { en: "Ask, and someone here will try to answer.", ml: "ചോദിക്കൂ, ഇവിടെ ആരെങ്കിലും ഉത്തരം നൽകാൻ ശ്രമിക്കും." },
  { en: "A campus improves only as fast as its students are willing to speak.", ml: "വിദ്യാർത്ഥികൾ സംസാരിക്കാൻ തയ്യാറാകുന്ന വേഗതയിൽ മാത്രമേ ഒരു ക്യാമ്പസ് മെച്ചപ്പെടൂ." },
  { en: "This form was built so distance is never the reason a problem goes unheard.", ml: "ദൂരം ഒരിക്കലും ഒരു പ്രശ്നം കേൾക്കാതെ പോകാനുള്ള കാരണമാകരുത് എന്നതിനാലാണ് ഈ ഫോം ഉണ്ടാക്കിയത്." },
  { en: "Every rupee and every repair starts with someone noticing a need.", ml: "ഓരോ രൂപയും ഓരോ അറ്റകുറ്റപ്പണിയും തുടങ്ങുന്നത് ഒരു ആവശ്യം ആരെങ്കിലും ശ്രദ്ധിക്കുന്നതിലൂടെയാണ്." },
  { en: "You deserve to know what happened after you spoke up, so we track every case.", ml: "നിങ്ങൾ സംസാരിച്ചതിന് ശേഷം എന്ത് സംഭവിച്ചു എന്നറിയാൻ നിങ്ങൾക്ക് അവകാശമുണ്ട്, അതുകൊണ്ട് ഞങ്ങൾ ഓരോ കേസും ട്രാക്ക് ചെയ്യുന്നു." },
  { en: "Kindness and honesty can share the same sentence.", ml: "ദയയും സത്യസന്ധതയും ഒരേ വാക്യത്തിൽ ഒരുമിച്ച് നിൽക്കാം." },
  { en: "The door to the chairperson is only ever as far as this button.", ml: "ചെയർപേഴ്‌സന്റെ അടുത്തേക്കുള്ള വാതിൽ ഈ ബട്ടൺ അകലെയേ ഉള്ളൂ." },
  { en: "We built this so no student has to wonder who is listening.", ml: "ആരാണ് കേൾക്കുന്നതെന്ന് ഒരു വിദ്യാർത്ഥിയും ചിന്തിക്കേണ്ടി വരരുത് എന്നതിനാലാണ് ഇത് ഞങ്ങൾ ഉണ്ടാക്കിയത്." },
  { en: "Progress here is measured in problems solved, not complaints avoided.", ml: "ഇവിടെ പുരോഗതി അളക്കുന്നത് ഒഴിവാക്കിയ പരാതികളിലല്ല, പരിഹരിച്ച പ്രശ്നങ്ങളിലാണ്." }
];
