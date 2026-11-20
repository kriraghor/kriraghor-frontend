/**
 * Legal and help pages (launch polish), drafted from the business rules v3 and the module specs.
 * DRAFT: every page shows "Draft, under legal review" until a lawyer signs it off
 * (kriraghor-docs open questions). Fees and time windows are never written here as numbers: they
 * live in platform settings (M03) and are shown on each payment and cancellation screen.
 *
 * A body item is a paragraph (string) or a bullet list (string[]).
 */
export type LegalDoc = {
  title: string;
  intro: string;
  sections: { id: string; title: string; body: (string | string[])[] }[];
};
export type LegalKey = "terms" | "privacy" | "refunds" | "protection" | "fairPlay";

export const LEGAL_VERSION = { version: "0.2", updated: "2026-10-25" };

const en: Record<LegalKey, LegalDoc> = {
  terms: {
    title: "Terms of use",
    intro: "These terms apply when you use kriraghor.com, esports.kriraghor.com, console.kriraghor.com and the Kriraghor app. By creating an account or paying through Kriraghor you agree to them.",
    sections: [
      {
        id: "about",
        title: "About Kriraghor",
        body: [
          "Kriraghor is a sports and esports platform for Bangladesh. You can book venues, buy gear, hire players, officials and coaches, buy gym subscriptions and trainer plans, and join esports and sports tournaments.",
          "Venue owners, shops, gyms, trainers, players for hire and tournament organisers provide their own services. Kriraghor runs the platform, takes the payments and holds the money until the service is delivered.",
          "[The legal entity that operates Kriraghor and its registered address will be added here before launch.]",
        ],
      },
      {
        id: "account",
        title: "Your account",
        body: [
          "One account works on every Kriraghor site and app. You can sign in with a code sent to your phone or email, with a password, or with Google.",
          [
            "Give your real name and keep your phone number and email up to date.",
            "Keep your password and codes to yourself. We will never ask for them.",
            "One account per person. Accounts can't be sold or shared.",
            "Some actions need more checks: a verified phone to book, register or hire; a verified game UID for esports; an approved NID to sell used gear, open a business or withdraw winnings.",
            "We ask for your NID only with your explicit consent each time you send it. How we use and protect it is in our Privacy policy.",
          ],
          "NID verification is for people aged 18 and over; there is no guardian route yet. [The minimum age for paid entry and prize withdrawal is still being decided (open questions Q116 and Q181).]",
        ],
      },
      {
        id: "payments",
        title: "Payments and how we hold your money",
        body: [
          "You pay online with bKash, Nagad or a card through our licensed payment partner. We never see or store your card details.",
          "Your payment is held by Kriraghor, not sent straight to the seller. It is released only when the service is delivered: at check-in for a venue, when you receive an order, when you confirm a finished job, when a gym admits you, or when tournament results are final.",
          "Kriraghor's fee is shown in the price breakdown before you pay. The fee in force when you pay is the one that applies to that payment.",
          "Refunds follow our Refund policy and go back to the way you paid.",
        ],
      },
      {
        id: "grounds",
        title: "Venue bookings",
        body: [
          [
            "You choose to pay the full price online or an advance online and the rest at the venue.",
            "If you cancel or don't show up, the advance is not refunded.",
            "If the owner cancels, you get a full refund.",
            "The booking, the price and the advance are confirmed on screen before you pay.",
          ],
        ],
      },
      {
        id: "shop",
        title: "Shop orders",
        body: [
          "New gear is sold by shops that Kriraghor has verified. The shop sees your name, phone and address only after it accepts your order.",
          "Supplements show the expiry date and batch number. Expired stock can't be sold, and opened supplements can't be returned.",
          "Used gear from NID-verified members is coming soon. It will also be paid online, and the money is released when you collect the item.",
        ],
      },
      {
        id: "hire",
        title: "Hiring players, officials and coaches",
        body: [
          "Talk to people for hire inside Kriraghor. Phone numbers stay hidden until you pay, so the deal and its protection stay on the platform.",
          "Your payment is held until the job is done. When the person marks the job complete you confirm it, or the money is released automatically after the period shown on the job, unless you open a dispute.",
          "Cancellation fees, if any, depend on how close to the job you cancel. The amount is shown before you confirm.",
        ],
      },
      {
        id: "gym",
        title: "Gym subscriptions and trainer plans",
        body: ["Gym subscriptions (one month, three months or longer) are shown as a QR code or a short code at the front desk. Trainer plans are paid month by month. The rules for each subscription or plan are shown before you buy."],
      },
      {
        id: "esports",
        title: "Esports tournaments",
        body: [
          [
            "Entry fees are paid online and held until results are final.",
            "The prize table is published before registration opens and is paid as published once the tournament runs.",
            "If a tournament doesn't reach its minimum number of players or squads, it is cancelled and everyone gets a full refund.",
            "You need a verified game UID, one per game. The room ID and password are shown only to checked-in players, shortly before the start.",
            "Results can be disputed for a short window after they are posted. After that they are final.",
            "Winnings are added to your Kriraghor balance. You can withdraw them to bKash or Nagad after your NID is approved.",
            "Our Fair play rules apply. A disqualified player or squad loses its prize.",
          ],
        ],
      },
      {
        id: "tournaments",
        title: "Sports tournaments",
        body: ["Verified organisers run football, cricket and other sports tournaments on Kriraghor. Each tournament page shows its rules, entry fee, prizes and refund rules. Entry fees are held by Kriraghor and paid to the organiser in parts as the tournament is played. Prizes in sports tournaments are paid by the organiser."],
      },
      {
        id: "conduct",
        title: "What you may not do",
        body: [
          [
            "Cheat, use hacks, or share room credentials.",
            "List fake venues, items or services, or copy someone else's photos.",
            "Put phone numbers or other contact details in listings or messages to take a deal off the platform.",
            "Harass, threaten or abuse anyone.",
            "Use someone else's account, NID or payment method.",
          ],
          "We may remove content, cancel bookings or registrations, and suspend accounts that break these rules.",
        ],
      },
      {
        id: "disputes",
        title: "Problems and disputes",
        body: ["If something goes wrong, open a dispute from your booking, order, job or tournament within the window shown there, and add evidence such as photos or screenshots. Kriraghor staff review both sides and decide how the held money is used. This doesn't affect your rights under Bangladesh law."],
      },
      {
        id: "suspension",
        title: "Suspension and holds",
        body: ["We may pause payouts or suspend an account while we look into fraud, cheating or a serious complaint. We will tell you why and how to respond. You can ask for a decision to be reviewed."],
      },
      {
        id: "liability",
        title: "Our responsibility",
        body: ["Owners, shops, gyms, trainers, people for hire and organisers are responsible for the services they provide. Kriraghor is responsible for running the platform and handling payments as these terms describe. Nothing here limits any responsibility that Bangladesh law does not allow us to limit."],
      },
      {
        id: "changes",
        title: "Changes to these terms",
        body: ["We will tell you about important changes in the app, by email or by SMS before they take effect. The version and date are at the top of this page."],
      },
      {
        id: "law",
        title: "Law",
        body: ["These terms are governed by the laws of Bangladesh. [The courts with jurisdiction will be confirmed during legal review.]"],
      },
      {
        id: "contact",
        title: "Contact",
        body: ["See the Help centre for answers and ways to reach us. [Support email and phone will be added before launch.]"],
      },
    ],
  },
  privacy: {
    title: "Privacy policy",
    intro: "This policy explains what personal data Kriraghor collects, why, who can see it and the choices you have.",
    sections: [
      {
        id: "collect",
        title: "What we collect",
        body: [
          [
            "Account: your name, phone number, email, username and password (stored only as a secure hash).",
            "Verification: your NID images and number, and business documents for business roles. These are encrypted, and every time staff open them it is recorded.",
            "Esports: your game UIDs and in-game names, results and rankings.",
            "Payouts: your bKash or Nagad number, encrypted and shown masked.",
            "Activity: bookings, orders, hires, passes, registrations, payments, reviews, reports and messages sent in Kriraghor.",
            "Delivery: the name, phone and address you give for an order.",
            "Location: only when you tap \"Use my location\", to sort venues by distance. It isn't stored.",
            "Technical: device, browser, IP address and logs, used for security and to fix problems.",
          ],
        ],
      },
      {
        id: "why",
        title: "Why we use it",
        body: [
          [
            "To provide the services you ask for and to take, hold and release payments.",
            "To verify people and businesses and to keep fake accounts, cheating and fraud off the platform.",
            "To send codes, receipts and notices. Security alerts, such as a password change, can't be switched off.",
            "To meet our legal, tax and accounting duties.",
          ],
        ],
      },
      {
        id: "who",
        title: "Who can see what",
        body: [
          [
            "A shop sees your name, phone and address only after it accepts your order.",
            "A person you hire, or who hires you, sees your phone number only after payment.",
            "A venue owner sees the name on your booking.",
            "Your public player page shows only what you choose to show. It never shows your gender, date of birth or phone.",
            "Our payment partner, SMS and email providers handle data only to deliver their service.",
            "Authorities, when Bangladesh law requires it.",
          ],
          "We don't sell your personal data.",
        ],
      },
      {
        id: "keep",
        title: "How long we keep it",
        body: ["We keep your data while your account is open and as long as the law requires for payment and tax records. Closing an account removes it from public view. The photos of your NID are deleted 90 days after the verification decision (see NID verification below). [The retention period for other verification records will be set during legal review.]"],
      },
      {
        id: "security",
        title: "How we protect it",
        body: ["NID numbers, payout account numbers and tournament room credentials are encrypted at rest. Staff can see only what their role needs, and sensitive views are recorded in an audit log."],
      },
      {
        id: "rights",
        title: "Your choices",
        body: [
          [
            "See and correct your details in My account.",
            "Choose which notices you get by SMS, email or in the app (security notices always come).",
            "Ask for a copy of your data, or close your account, through the Help centre.",
          ],
        ],
      },
      {
        id: "nid",
        title: "NID verification",
        body: [
          "We ask for your National ID (NID) only when you need it: to sell on Kriraghor, to be hired, to receive business payouts or to withdraw winnings. It lets us check who you are and keep fraud off the platform.",
          [
            "What we collect: your NID number, the name and date of birth on it, and photos of its front and back and a selfie of you holding it.",
            "Who sees it: only Kriraghor review staff. The NID number is encrypted, only its last 4 digits are shown, and every view is recorded.",
            "How long: the photos are deleted 90 days after the verification decision.",
            "Age: NID verification is for people aged 18 and over.",
          ],
          "We ask for your consent explicitly each time you send your NID. You can withdraw it by asking Kriraghor support; we then delete your verification data, except what the law requires us to keep.",
        ],
      },
      { id: "children", title: "Children", body: ["NID verification is for people aged 18 and over; there is no guardian route yet. [The minimum age for an account, and for paid entry and withdrawals, is still being decided (open questions Q116 and Q181).]"] },
      { id: "changes", title: "Changes", body: ["We will tell you about important changes before they take effect. The version and date are at the top of this page."] },
      { id: "contact", title: "Contact", body: ["See the Help centre. [A privacy contact will be added before launch.]"] },
    ],
  },
  refunds: {
    title: "Refund policy",
    intro: "Refunds go back to the way you paid (bKash, Nagad or card). How long they take depends on your wallet or bank. The exact amount for your case is always shown before you confirm a cancellation.",
    sections: [
      {
        id: "grounds",
        title: "Venue bookings",
        body: [
          [
            "You cancel or don't show up: the advance is not refunded. If you paid the full price online, the part above the advance is refunded.",
            "The owner cancels: full refund.",
            "Something went wrong at the venue: open a dispute from the booking within the window shown there.",
          ],
        ],
      },
      {
        id: "esports",
        title: "Esports tournaments",
        body: [
          [
            "Not enough players or squads by the time registration closes: the tournament is cancelled and everyone gets a full refund.",
            "You withdraw before registration closes: refunded as shown on the tournament page.",
            "After registration closes, entry fees are not refunded. A disqualified player or squad gets no refund and loses its prize.",
          ],
        ],
      },
      {
        id: "tournaments",
        title: "Sports tournaments",
        body: [
          [
            "The organiser rejects your team, or the tournament is cancelled before the first result: full refund.",
            "The tournament is cancelled after it has started: the part of the entry fee not yet paid to the organiser is refunded.",
            "Your team withdraws after registration closes: a partial refund, as shown in the tournament's rules.",
          ],
        ],
      },
      {
        id: "orders",
        title: "Shop orders",
        body: [
          [
            "The shop rejects your order or doesn't ship it in time: full refund.",
            "The order doesn't arrive: open a \"not received\" dispute from the order.",
            "Returns follow each shop's return window, shown on the product page. Opened supplements can't be returned.",
          ],
        ],
      },
      {
        id: "hire",
        title: "Hiring",
        body: [
          [
            "You cancel early enough: full refund. Closer to the job, a cancellation fee may apply. The amount is shown before you confirm.",
            "The person you hired cancels or doesn't come: full refund.",
          ],
        ],
      },
      {
        id: "gym",
        title: "Gym subscriptions and trainer plans",
        body: [["Unused subscriptions follow the rules shown when you bought them.", "A trainer plan cancelled within its first days is refunded in full; the number of days is shown on the plan."]],
      },
      { id: "ask", title: "How to ask for a refund", body: ["Open the booking, order, job, pass or registration in My account and choose cancel or report a problem. Our staff will reply in the app."] },
    ],
  },
  protection: {
    title: "Buyer protection",
    intro: "When you pay through Kriraghor, the money is held safely and released only when you get what you paid for.",
    sections: [
      {
        id: "how",
        title: "When the money is released",
        body: [
          [
            "Venues: at check-in, or automatically after the booking, unless you open a dispute.",
            "Shop orders: when you mark the order received, or automatically after delivery, unless you report a problem.",
            "Hiring: when you confirm the job is done, or automatically after the period shown on the job, unless you open a dispute.",
            "Gym subscriptions: when the gym admits you, or when an unused subscription expires.",
            "Esports: entry fees stay held until results are final and prizes are paid.",
            "Sports tournaments: entry fees are paid to the organiser in two parts, after the first result and at the end.",
          ],
        ],
      },
      { id: "dispute", title: "If something goes wrong", body: ["Open a dispute from the booking, order or job and add evidence. While a dispute is open, the money stays held. Kriraghor staff review both sides and decide."] },
      { id: "not", title: "What isn't covered", body: [["Cash paid at a venue or to a seller directly.", "Deals agreed outside Kriraghor, for example by phone after someone shares their number in a listing."]] },
    ],
  },
  fairPlay: {
    title: "Fair play rules",
    intro: "Esports on Kriraghor is for real players competing fairly. These rules apply to every Kriraghor and organiser tournament.",
    sections: [
      {
        id: "rules",
        title: "The rules",
        body: [
          [
            "One game UID per account for each game. The UID must be yours.",
            "No hacks, cheats, modified game files, or emulators where a tournament doesn't allow them.",
            "No teaming with other squads, and no sharing the room ID or password.",
            "Play under your own account. Don't let anyone else play for you.",
            "Respect other players, staff and organisers.",
          ],
        ],
      },
      { id: "reports", title: "Reporting cheating", body: ["Report cheating from the tournament page with evidence such as a video or screenshots. Reports without evidence can't be acted on."] },
      {
        id: "penalties",
        title: "Penalties",
        body: [["A warning, a points penalty or disqualification from the match or tournament.", "A disqualified player or squad loses its prize.", "Serious or repeated cheating can lead to a ban of the game UID and the account."]],
      },
      { id: "decisions", title: "Decisions", body: ["Staff decide using the evidence and the tournament's rules. You can dispute a result within the window shown after it is posted."] },
    ],
  },
};

const bn: Record<LegalKey, LegalDoc> = {
  terms: {
    title: "ব্যবহারের শর্তাবলি",
    intro: "kriraghor.com, esports.kriraghor.com, console.kriraghor.com এবং ক্রীড়াঘর অ্যাপ ব্যবহারে এই শর্তগুলো প্রযোজ্য। অ্যাকাউন্ট খুললে বা ক্রীড়াঘরের মাধ্যমে পেমেন্ট করলে আপনি এগুলো মেনে নিচ্ছেন।",
    sections: [
      {
        id: "about",
        title: "ক্রীড়াঘর সম্পর্কে",
        body: [
          "ক্রীড়াঘর বাংলাদেশের খেলাধুলা ও ই-স্পোর্টসের প্ল্যাটফর্ম। এখানে ভেন্যু বুক করা, খেলার সরঞ্জাম কেনা, খেলোয়াড়-আম্পায়ার-কোচ হায়ার করা, জিম সাবস্ক্রিপশন ও ট্রেইনার প্ল্যান কেনা এবং ই-স্পোর্টস ও খেলার টুর্নামেন্টে অংশ নেওয়া যায়।",
          "ভেন্যুর মালিক, দোকান, জিম, ট্রেইনার, হায়ারের লোক ও টুর্নামেন্ট আয়োজকরা নিজেদের সেবা দেন। ক্রীড়াঘর প্ল্যাটফর্ম চালায়, পেমেন্ট নেয় এবং সেবা পাওয়া পর্যন্ত টাকা নিজের কাছে রাখে।",
          "[ক্রীড়াঘর পরিচালনাকারী প্রতিষ্ঠানের আইনি নাম ও নিবন্ধিত ঠিকানা চালুর আগে এখানে যোগ হবে।]",
        ],
      },
      {
        id: "account",
        title: "আপনার অ্যাকাউন্ট",
        body: [
          "একটি অ্যাকাউন্ট দিয়ে ক্রীড়াঘরের সব সাইট ও অ্যাপ চলে। ফোন বা ইমেইলে পাঠানো কোড, পাসওয়ার্ড অথবা গুগল দিয়ে সাইন ইন করা যায়।",
          [
            "আপনার আসল নাম দিন এবং ফোন নম্বর ও ইমেইল হালনাগাদ রাখুন।",
            "পাসওয়ার্ড ও কোড কাউকে দেবেন না। আমরা কখনো এগুলো চাইব না।",
            "একজনের একটি অ্যাকাউন্ট। অ্যাকাউন্ট বিক্রি বা শেয়ার করা যাবে না।",
            "কিছু কাজে বাড়তি যাচাই লাগে: বুকিং, রেজিস্ট্রেশন বা হায়ারে যাচাই করা ফোন; ই-স্পোর্টসে যাচাই করা গেম UID; পুরনো জিনিস বিক্রি, ব্যবসা খোলা বা পুরস্কারের টাকা তুলতে অনুমোদিত NID।",
            "প্রতিবার NID পাঠানোর সময় আমরা আপনার স্পষ্ট সম্মতি নিই। আমরা কীভাবে তা ব্যবহার ও সুরক্ষা করি, তা গোপনীয়তা নীতিতে আছে।",
          ],
          "NID যাচাই শুধু ১৮ বছর বা তার বেশি বয়সীদের জন্য; অভিভাবকের মাধ্যমে যাচাইয়ের ব্যবস্থা এখনো নেই। [পেইড এন্ট্রি ও পুরস্কার তোলার ন্যূনতম বয়স এখনো ঠিক হচ্ছে (খোলা প্রশ্ন Q116 ও Q181)।]",
        ],
      },
      {
        id: "payments",
        title: "পেমেন্ট এবং আমরা কীভাবে টাকা রাখি",
        body: [
          "বিকাশ, নগদ বা কার্ডে আমাদের লাইসেন্সপ্রাপ্ত পেমেন্ট পার্টনারের মাধ্যমে অনলাইনে পেমেন্ট করবেন। আপনার কার্ডের তথ্য আমরা দেখি না, রাখিও না।",
          "আপনার টাকা সরাসরি বিক্রেতার কাছে যায় না, ক্রীড়াঘরের কাছে জমা থাকে। সেবা পাওয়ার পরই তা ছাড়া হয়: ভেন্যুতে চেক-ইনে, অর্ডার হাতে পেলে, কাজ শেষ বলে নিশ্চিত করলে, জিমে ঢোকার সময়, বা টুর্নামেন্টের ফলাফল চূড়ান্ত হলে।",
          "পেমেন্টের আগে দামের বিবরণে ক্রীড়াঘরের ফি দেখানো হয়। আপনি যখন পেমেন্ট করেন, তখনকার ফি-ই সেই পেমেন্টে প্রযোজ্য।",
          "রিফান্ড আমাদের রিফান্ড নীতি অনুযায়ী হয় এবং যে মাধ্যমে পেমেন্ট করেছেন সেখানেই ফেরত যায়।",
        ],
      },
      {
        id: "grounds",
        title: "ভেন্যু বুকিং",
        body: [
          [
            "পুরো দাম অনলাইনে দেবেন, নাকি অগ্রিম অনলাইনে দিয়ে বাকিটা ভেন্যুতে দেবেন, তা আপনি বেছে নেন।",
            "আপনি বাতিল করলে বা না এলে অগ্রিম ফেরত হয় না।",
            "মালিক বাতিল করলে পুরো টাকা ফেরত পাবেন।",
            "পেমেন্টের আগে বুকিং, দাম ও অগ্রিম স্ক্রিনে নিশ্চিত করা হয়।",
          ],
        ],
      },
      {
        id: "shop",
        title: "শপের অর্ডার",
        body: [
          "নতুন জিনিস বিক্রি করে ক্রীড়াঘরের যাচাই করা দোকান। দোকান আপনার অর্ডার গ্রহণ করার পরই আপনার নাম, ফোন ও ঠিকানা দেখতে পায়।",
          "সাপ্লিমেন্টে মেয়াদ ও ব্যাচ নম্বর দেখানো হয়। মেয়াদোত্তীর্ণ জিনিস বিক্রি করা যায় না, খোলা সাপ্লিমেন্ট ফেরত নেওয়া হয় না।",
          "NID যাচাই করা সদস্যদের পুরনো জিনিস শিগগিরই আসছে। সেটিও অনলাইনে পেমেন্ট হবে, আর জিনিস হাতে নিলে টাকা ছাড়া হবে।",
        ],
      },
      {
        id: "hire",
        title: "খেলোয়াড়, অফিশিয়াল ও কোচ হায়ার",
        body: [
          "হায়ারের লোকের সঙ্গে ক্রীড়াঘরের ভেতরেই কথা বলুন। পেমেন্টের আগ পর্যন্ত ফোন নম্বর লুকানো থাকে, যাতে চুক্তি ও তার সুরক্ষা প্ল্যাটফর্মেই থাকে।",
          "কাজ শেষ না হওয়া পর্যন্ত টাকা জমা থাকে। কাজ শেষ বলে জানানোর পর আপনি নিশ্চিত করলে, অথবা কাজে দেখানো সময় পেরোলে নিজে থেকেই টাকা ছাড়া হয়, যদি না আপনি অভিযোগ করেন।",
          "বাতিলের ফি থাকলে তা কাজের কত আগে বাতিল করছেন তার ওপর নির্ভর করে। নিশ্চিত করার আগে পরিমাণ দেখানো হয়।",
        ],
      },
      {
        id: "gym",
        title: "জিম সাবস্ক্রিপশন ও ট্রেইনার প্ল্যান",
        body: ["জিম সাবস্ক্রিপশন (এক মাস, তিন মাস বা আরও লম্বা) ফ্রন্ট ডেস্কে QR কোড বা ছোট কোড হিসেবে দেখাবেন। ট্রেইনার প্ল্যানের টাকা মাসে মাসে দিতে হয়। প্রতিটি সাবস্ক্রিপশন বা প্ল্যানের নিয়ম কেনার আগে দেখানো হয়।"],
      },
      {
        id: "esports",
        title: "ই-স্পোর্টস টুর্নামেন্ট",
        body: [
          [
            "এন্ট্রি ফি অনলাইনে দিতে হয় এবং ফলাফল চূড়ান্ত না হওয়া পর্যন্ত জমা থাকে।",
            "রেজিস্ট্রেশন খোলার আগে পুরস্কারের তালিকা প্রকাশ করা হয়, এবং টুর্নামেন্ট হলে সেভাবেই পুরস্কার দেওয়া হয়।",
            "ন্যূনতম খেলোয়াড় বা স্কোয়াড না হলে টুর্নামেন্ট বাতিল হয় এবং সবাই পুরো টাকা ফেরত পান।",
            "যাচাই করা গেম UID লাগবে, প্রতি গেমে একটি। রুম আইডি ও পাসওয়ার্ড শুধু চেক-ইন করা খেলোয়াড়রা শুরুর কিছুক্ষণ আগে দেখতে পান।",
            "ফলাফল প্রকাশের পর অল্প সময়ের মধ্যে আপত্তি জানানো যায়। এরপর ফলাফল চূড়ান্ত।",
            "পুরস্কারের টাকা আপনার ক্রীড়াঘর ব্যালান্সে যোগ হয়। NID অনুমোদনের পর বিকাশ বা নগদে তুলতে পারবেন।",
            "আমাদের ফেয়ার প্লে নিয়ম প্রযোজ্য। বাতিল হওয়া খেলোয়াড় বা স্কোয়াড পুরস্কার পায় না।",
          ],
        ],
      },
      {
        id: "tournaments",
        title: "খেলার টুর্নামেন্ট",
        body: ["যাচাই করা আয়োজকরা ক্রীড়াঘরে ফুটবল, ক্রিকেটসহ নানা খেলার টুর্নামেন্ট চালান। প্রতিটি টুর্নামেন্টের পাতায় নিয়ম, এন্ট্রি ফি, পুরস্কার ও রিফান্ডের নিয়ম থাকে। এন্ট্রি ফি ক্রীড়াঘরের কাছে জমা থাকে এবং খেলা এগোনোর সঙ্গে ধাপে ধাপে আয়োজককে দেওয়া হয়। খেলার টুর্নামেন্টের পুরস্কার দেন আয়োজক।"],
      },
      {
        id: "conduct",
        title: "যা করা যাবে না",
        body: [
          [
            "প্রতারণা, হ্যাক ব্যবহার, বা রুমের তথ্য অন্যকে দেওয়া।",
            "ভুয়া ভেন্যু, জিনিস বা সেবার তালিকা দেওয়া, বা অন্যের ছবি নকল করা।",
            "প্ল্যাটফর্মের বাইরে চুক্তি করতে তালিকা বা মেসেজে ফোন নম্বর বা যোগাযোগের তথ্য দেওয়া।",
            "কাউকে হয়রানি, হুমকি বা গালাগাল করা।",
            "অন্যের অ্যাকাউন্ট, NID বা পেমেন্ট মাধ্যম ব্যবহার করা।",
          ],
          "এই নিয়ম ভাঙলে আমরা কনটেন্ট সরাতে, বুকিং বা রেজিস্ট্রেশন বাতিল করতে এবং অ্যাকাউন্ট স্থগিত করতে পারি।",
        ],
      },
      {
        id: "disputes",
        title: "সমস্যা ও অভিযোগ",
        body: ["কোনো সমস্যা হলে বুকিং, অর্ডার, কাজ বা টুর্নামেন্ট থেকে সেখানে দেখানো সময়ের মধ্যে অভিযোগ খুলুন এবং ছবি বা স্ক্রিনশটের মতো প্রমাণ দিন। ক্রীড়াঘরের কর্মীরা দুই পক্ষের কথা দেখে জমা টাকার বিষয়ে সিদ্ধান্ত নেন। এতে বাংলাদেশের আইনে আপনার অধিকার ক্ষুণ্ন হয় না।"],
      },
      {
        id: "suspension",
        title: "স্থগিত ও আটকে রাখা",
        body: ["প্রতারণা, চিটিং বা গুরুতর অভিযোগ যাচাইয়ের সময় আমরা পেআউট থামিয়ে রাখতে বা অ্যাকাউন্ট স্থগিত করতে পারি। কেন, এবং কীভাবে জবাব দেবেন, তা আমরা জানাব। সিদ্ধান্ত পুনর্বিবেচনার অনুরোধ করতে পারবেন।"],
      },
      {
        id: "liability",
        title: "আমাদের দায়",
        body: ["মালিক, দোকান, জিম, ট্রেইনার, হায়ারের লোক ও আয়োজকরা নিজেদের সেবার জন্য দায়ী। প্ল্যাটফর্ম চালানো এবং এই শর্তে বলা মতো পেমেন্ট সামলানোর দায় ক্রীড়াঘরের। বাংলাদেশের আইন যে দায় কমাতে দেয় না, এখানে তা কমানো হয়নি।"],
      },
      { id: "changes", title: "শর্তের পরিবর্তন", body: ["গুরুত্বপূর্ণ পরিবর্তন কার্যকর হওয়ার আগে অ্যাপে, ইমেইলে বা SMS-এ জানাব। সংস্করণ ও তারিখ এই পাতার ওপরে আছে।"] },
      { id: "law", title: "আইন", body: ["এই শর্তাবলি বাংলাদেশের আইন অনুযায়ী পরিচালিত। [এখতিয়ারসম্পন্ন আদালত আইনি পর্যালোচনায় নিশ্চিত হবে।]"] },
      { id: "contact", title: "যোগাযোগ", body: ["উত্তর ও যোগাযোগের উপায়ের জন্য হেল্প সেন্টার দেখুন। [সাপোর্টের ইমেইল ও ফোন চালুর আগে যোগ হবে।]"] },
    ],
  },
  privacy: {
    title: "গোপনীয়তা নীতি",
    intro: "ক্রীড়াঘর কোন ব্যক্তিগত তথ্য নেয়, কেন নেয়, কারা দেখতে পায় এবং আপনার কী কী বেছে নেওয়ার সুযোগ আছে, এই নীতিতে তা বলা আছে।",
    sections: [
      {
        id: "collect",
        title: "আমরা যা সংগ্রহ করি",
        body: [
          [
            "অ্যাকাউন্ট: নাম, ফোন নম্বর, ইমেইল, ইউজারনেম ও পাসওয়ার্ড (শুধু নিরাপদ হ্যাশ হিসেবে রাখা হয়)।",
            "যাচাই: আপনার NID-এর ছবি ও নম্বর, এবং ব্যবসার ভূমিকার জন্য কাগজপত্র। এগুলো এনক্রিপ্ট করা থাকে, আর কর্মীরা যতবার খোলেন তা রেকর্ড হয়।",
            "ই-স্পোর্টস: গেম UID, গেমের নাম, ফলাফল ও র‍্যাংকিং।",
            "পেআউট: আপনার বিকাশ বা নগদ নম্বর, এনক্রিপ্ট করা এবং আংশিক লুকিয়ে দেখানো।",
            "কার্যক্রম: বুকিং, অর্ডার, হায়ার, সাবস্ক্রিপশন, রেজিস্ট্রেশন, পেমেন্ট, রিভিউ, রিপোর্ট ও ক্রীড়াঘরে পাঠানো মেসেজ।",
            "ডেলিভারি: অর্ডারের জন্য দেওয়া নাম, ফোন ও ঠিকানা।",
            "লোকেশন: শুধু \"আমার লোকেশন ব্যবহার করুন\" চাপলে, দূরত্ব অনুযায়ী ভেন্যু সাজাতে। এটি রাখা হয় না।",
            "প্রযুক্তিগত: ডিভাইস, ব্রাউজার, IP ঠিকানা ও লগ, নিরাপত্তা ও সমস্যা সমাধানের জন্য।",
          ],
        ],
      },
      {
        id: "why",
        title: "কেন ব্যবহার করি",
        body: [
          [
            "আপনার চাওয়া সেবা দিতে এবং পেমেন্ট নিতে, জমা রাখতে ও ছাড়তে।",
            "মানুষ ও ব্যবসা যাচাই করতে, এবং ভুয়া অ্যাকাউন্ট, চিটিং ও প্রতারণা ঠেকাতে।",
            "কোড, রসিদ ও নোটিশ পাঠাতে। পাসওয়ার্ড বদলের মতো নিরাপত্তা সতর্কতা বন্ধ করা যায় না।",
            "আইন, কর ও হিসাবের দায়িত্ব পালন করতে।",
          ],
        ],
      },
      {
        id: "who",
        title: "কে কী দেখতে পায়",
        body: [
          [
            "দোকান আপনার অর্ডার গ্রহণের পরই আপনার নাম, ফোন ও ঠিকানা দেখে।",
            "যাকে হায়ার করেন বা যিনি আপনাকে হায়ার করেন, পেমেন্টের পরই আপনার ফোন নম্বর দেখেন।",
            "ভেন্যুর মালিক আপনার বুকিংয়ের নাম দেখেন।",
            "আপনার পাবলিক প্লেয়ার পাতায় শুধু আপনি যা দেখাতে চান তা-ই থাকে। লিঙ্গ, জন্মতারিখ বা ফোন কখনো দেখায় না।",
            "আমাদের পেমেন্ট পার্টনার, SMS ও ইমেইল প্রদানকারী শুধু তাদের সেবা দিতে তথ্য ব্যবহার করে।",
            "বাংলাদেশের আইন অনুযায়ী প্রয়োজনে কর্তৃপক্ষ।",
          ],
          "আমরা আপনার ব্যক্তিগত তথ্য বিক্রি করি না।",
        ],
      },
      { id: "keep", title: "কতদিন রাখি", body: ["অ্যাকাউন্ট খোলা থাকা পর্যন্ত, এবং পেমেন্ট ও করের রেকর্ডের জন্য আইন যতদিন চায় ততদিন তথ্য রাখি। অ্যাকাউন্ট বন্ধ করলে তা আর প্রকাশ্যে দেখা যায় না। যাচাইয়ের সিদ্ধান্তের ৯০ দিন পর আপনার NID-এর ছবি মুছে ফেলা হয় (নিচে NID যাচাই অংশ দেখুন)। [যাচাইয়ের অন্যান্য রেকর্ড কতদিন রাখা হবে, তা আইনি পর্যালোচনায় ঠিক হবে।]"] },
      { id: "security", title: "কীভাবে সুরক্ষা দিই", body: ["NID নম্বর, পেআউট অ্যাকাউন্ট নম্বর ও টুর্নামেন্টের রুমের তথ্য এনক্রিপ্ট করে রাখা হয়। কর্মীরা শুধু তাঁদের কাজের জন্য যা দরকার তা-ই দেখেন, আর সংবেদনশীল তথ্য দেখলে অডিট লগে রেকর্ড হয়।"] },
      {
        id: "rights",
        title: "আপনার সুযোগ",
        body: [["আমার অ্যাকাউন্টে নিজের তথ্য দেখুন ও ঠিক করুন।", "কোন নোটিশ SMS, ইমেইল বা অ্যাপে পাবেন তা বেছে নিন (নিরাপত্তা নোটিশ সবসময় আসবে)।", "হেল্প সেন্টারের মাধ্যমে নিজের তথ্যের কপি চাইতে বা অ্যাকাউন্ট বন্ধ করতে পারবেন।"]],
      },
      {
        id: "nid",
        title: "NID যাচাই",
        body: [
          "আপনার জাতীয় পরিচয়পত্র (NID) আমরা শুধু দরকার হলেই চাই: ক্রীড়াঘরে বিক্রি করতে, হায়ার হতে, ব্যবসার পেআউট পেতে বা পুরস্কারের টাকা তুলতে। এতে আমরা আপনার পরিচয় যাচাই করি এবং প্ল্যাটফর্মে প্রতারণা ঠেকাই।",
          [
            "যা নিই: আপনার NID নম্বর, তাতে লেখা নাম ও জন্মতারিখ, এবং NID-এর সামনে ও পেছনের ছবি আর NID হাতে আপনার একটি সেলফি।",
            "কে দেখেন: শুধু ক্রীড়াঘরের যাচাইকারী কর্মীরা। NID নম্বর এনক্রিপ্ট করা থাকে, শুধু শেষ ৪টি সংখ্যা দেখানো হয়, আর প্রতিবার দেখা রেকর্ড হয়।",
            "কতদিন: যাচাইয়ের সিদ্ধান্তের ৯০ দিন পর ছবিগুলো মুছে ফেলা হয়।",
            "বয়স: NID যাচাই শুধু ১৮ বছর বা তার বেশি বয়সীদের জন্য।",
          ],
          "প্রতিবার NID পাঠানোর সময় আমরা আপনার স্পষ্ট সম্মতি নিই। ক্রীড়াঘর সাপোর্টকে জানিয়ে আপনি সম্মতি তুলে নিতে পারেন; তখন আমরা আপনার যাচাইয়ের তথ্য মুছে ফেলি, শুধু আইন যা রাখতে বলে তা ছাড়া।",
        ],
      },
      { id: "children", title: "শিশু", body: ["NID যাচাই শুধু ১৮ বছর বা তার বেশি বয়সীদের জন্য; অভিভাবকের মাধ্যমে যাচাইয়ের ব্যবস্থা এখনো নেই। [অ্যাকাউন্ট খোলা, পেইড এন্ট্রি ও টাকা তোলার ন্যূনতম বয়স এখনো ঠিক হচ্ছে (খোলা প্রশ্ন Q116 ও Q181)।]"] },
      { id: "changes", title: "পরিবর্তন", body: ["গুরুত্বপূর্ণ পরিবর্তন কার্যকর হওয়ার আগে জানাব। সংস্করণ ও তারিখ এই পাতার ওপরে আছে।"] },
      { id: "contact", title: "যোগাযোগ", body: ["হেল্প সেন্টার দেখুন। [গোপনীয়তা বিষয়ে যোগাযোগের ঠিকানা চালুর আগে যোগ হবে।]"] },
    ],
  },
  refunds: {
    title: "রিফান্ড নীতি",
    intro: "রিফান্ড সেই মাধ্যমেই ফেরত যায় যেভাবে পেমেন্ট করেছিলেন (বিকাশ, নগদ বা কার্ড)। কতদিন লাগবে তা আপনার ওয়ালেট বা ব্যাংকের ওপর নির্ভর করে। বাতিল নিশ্চিত করার আগে আপনার ক্ষেত্রে সঠিক পরিমাণ সবসময় দেখানো হয়।",
    sections: [
      {
        id: "grounds",
        title: "ভেন্যু বুকিং",
        body: [["আপনি বাতিল করলে বা না এলে: অগ্রিম ফেরত হয় না। পুরো দাম অনলাইনে দিয়ে থাকলে অগ্রিমের বাড়তি অংশ ফেরত পাবেন।", "মালিক বাতিল করলে: পুরো টাকা ফেরত।", "ভেন্যুতে সমস্যা হলে: বুকিং থেকে সেখানে দেখানো সময়ের মধ্যে অভিযোগ খুলুন।"]],
      },
      {
        id: "esports",
        title: "ই-স্পোর্টস টুর্নামেন্ট",
        body: [["রেজিস্ট্রেশন বন্ধের সময় যথেষ্ট খেলোয়াড় বা স্কোয়াড না হলে: টুর্নামেন্ট বাতিল হয় এবং সবাই পুরো টাকা ফেরত পান।", "রেজিস্ট্রেশন বন্ধের আগে নাম তুলে নিলে: টুর্নামেন্টের পাতায় দেখানো অনুযায়ী ফেরত।", "রেজিস্ট্রেশন বন্ধের পর এন্ট্রি ফি ফেরত হয় না। বাতিল হওয়া খেলোয়াড় বা স্কোয়াড টাকা ফেরত পায় না এবং পুরস্কারও পায় না।"]],
      },
      {
        id: "tournaments",
        title: "খেলার টুর্নামেন্ট",
        body: [["আয়োজক আপনার দল বাতিল করলে, বা প্রথম ফলাফলের আগে টুর্নামেন্ট বাতিল হলে: পুরো টাকা ফেরত।", "শুরুর পর টুর্নামেন্ট বাতিল হলে: এন্ট্রি ফির যে অংশ এখনো আয়োজককে দেওয়া হয়নি তা ফেরত।", "রেজিস্ট্রেশন বন্ধের পর দল নাম তুলে নিলে: টুর্নামেন্টের নিয়মে দেখানো আংশিক ফেরত।"]],
      },
      {
        id: "orders",
        title: "শপের অর্ডার",
        body: [["দোকান অর্ডার বাতিল করলে বা সময়মতো না পাঠালে: পুরো টাকা ফেরত।", "অর্ডার না পৌঁছালে: অর্ডার থেকে \"পাইনি\" অভিযোগ খুলুন।", "ফেরত দেওয়ার নিয়ম প্রতিটি দোকানের, পণ্যের পাতায় দেখানো থাকে। খোলা সাপ্লিমেন্ট ফেরত নেওয়া হয় না।"]],
      },
      { id: "hire", title: "হায়ার", body: [["যথেষ্ট আগে বাতিল করলে: পুরো টাকা ফেরত। কাজের কাছাকাছি সময়ে বাতিলে ফি লাগতে পারে; নিশ্চিত করার আগে পরিমাণ দেখানো হয়।", "যাকে হায়ার করেছেন তিনি বাতিল করলে বা না এলে: পুরো টাকা ফেরত।"]] },
      { id: "gym", title: "জিম সাবস্ক্রিপশন ও ট্রেইনার প্ল্যান", body: [["অব্যবহৃত সাবস্ক্রিপশন কেনার সময় দেখানো নিয়ম মেনে চলে।", "ট্রেইনার প্ল্যান প্রথম কয়েক দিনের মধ্যে বাতিল করলে পুরো টাকা ফেরত; কত দিন, তা প্ল্যানে দেখানো থাকে।"]] },
      { id: "ask", title: "কীভাবে রিফান্ড চাইবেন", body: ["আমার অ্যাকাউন্টে বুকিং, অর্ডার, কাজ, সাবস্ক্রিপশন বা রেজিস্ট্রেশন খুলে বাতিল বা সমস্যা জানান বেছে নিন। আমাদের কর্মীরা অ্যাপে উত্তর দেবেন।"] },
    ],
  },
  protection: {
    title: "ক্রেতা সুরক্ষা",
    intro: "ক্রীড়াঘরে পেমেন্ট করলে টাকা নিরাপদে জমা থাকে, এবং যা কিনেছেন তা পেলেই ছাড়া হয়।",
    sections: [
      {
        id: "how",
        title: "টাকা কখন ছাড়া হয়",
        body: [
          [
            "ভেন্যু: চেক-ইনে, অথবা বুকিংয়ের পর নিজে থেকে, যদি না আপনি অভিযোগ করেন।",
            "শপের অর্ডার: অর্ডার পেয়েছেন জানালে, অথবা ডেলিভারির পর নিজে থেকে, যদি না সমস্যা জানান।",
            "হায়ার: কাজ শেষ বলে নিশ্চিত করলে, অথবা কাজে দেখানো সময় পেরোলে নিজে থেকে, যদি না অভিযোগ করেন।",
            "জিম সাবস্ক্রিপশন: জিমে ঢোকার সময়, অথবা অব্যবহৃত সাবস্ক্রিপশনের মেয়াদ শেষ হলে।",
            "ই-স্পোর্টস: ফলাফল চূড়ান্ত হয়ে পুরস্কার দেওয়া পর্যন্ত এন্ট্রি ফি জমা থাকে।",
            "খেলার টুর্নামেন্ট: এন্ট্রি ফি আয়োজককে দুই ধাপে দেওয়া হয়, প্রথম ফলাফলের পর এবং শেষে।",
          ],
        ],
      },
      { id: "dispute", title: "সমস্যা হলে", body: ["বুকিং, অর্ডার বা কাজ থেকে অভিযোগ খুলে প্রমাণ দিন। অভিযোগ খোলা থাকা পর্যন্ত টাকা জমা থাকে। ক্রীড়াঘরের কর্মীরা দুই পক্ষ দেখে সিদ্ধান্ত নেন।"] },
      { id: "not", title: "যা এর আওতায় পড়ে না", body: [["ভেন্যুতে বা বিক্রেতাকে সরাসরি নগদে দেওয়া টাকা।", "ক্রীড়াঘরের বাইরে করা চুক্তি, যেমন তালিকায় কেউ নম্বর দেওয়ার পর ফোনে ঠিক করা।"]] },
    ],
  },
  fairPlay: {
    title: "ফেয়ার প্লে নিয়ম",
    intro: "ক্রীড়াঘরের ই-স্পোর্টস আসল খেলোয়াড়দের ন্যায্য প্রতিযোগিতার জন্য। ক্রীড়াঘর ও আয়োজকদের সব টুর্নামেন্টে এই নিয়ম প্রযোজ্য।",
    sections: [
      {
        id: "rules",
        title: "নিয়ম",
        body: [["প্রতি গেমে প্রতি অ্যাকাউন্টে একটি গেম UID। UID আপনার নিজের হতে হবে।", "হ্যাক, চিট, বদলানো গেম ফাইল চলবে না; টুর্নামেন্ট অনুমতি না দিলে এমুলেটরও না।", "অন্য স্কোয়াডের সঙ্গে টিমিং চলবে না, রুম আইডি বা পাসওয়ার্ড কাউকে দেওয়া যাবে না।", "নিজের অ্যাকাউন্টে নিজে খেলুন। আপনার হয়ে অন্য কাউকে খেলতে দেবেন না।", "অন্য খেলোয়াড়, কর্মী ও আয়োজকদের সম্মান করুন।"]],
      },
      { id: "reports", title: "চিটিং রিপোর্ট", body: ["টুর্নামেন্টের পাতা থেকে ভিডিও বা স্ক্রিনশটের মতো প্রমাণসহ চিটিং রিপোর্ট করুন। প্রমাণ ছাড়া রিপোর্টে ব্যবস্থা নেওয়া যায় না।"] },
      { id: "penalties", title: "শাস্তি", body: [["সতর্কবার্তা, পয়েন্ট কাটা, অথবা ম্যাচ বা টুর্নামেন্ট থেকে বাদ।", "বাদ পড়া খেলোয়াড় বা স্কোয়াড পুরস্কার পায় না।", "গুরুতর বা বারবার চিটিংয়ে গেম UID ও অ্যাকাউন্ট নিষিদ্ধ হতে পারে।"]] },
      { id: "decisions", title: "সিদ্ধান্ত", body: ["প্রমাণ ও টুর্নামেন্টের নিয়ম দেখে কর্মীরা সিদ্ধান্ত নেন। ফলাফল প্রকাশের পর দেখানো সময়ের মধ্যে আপত্তি জানাতে পারবেন।"] },
    ],
  },
};

export const legalDoc = (key: LegalKey, locale: string): LegalDoc => (locale === "bn" ? bn : en)[key];

// ---------------- Help centre (FAQ) ----------------

export type FaqGroup = { id: string; title: string; items: { q: string; a: string; link?: { href: string; label: string } }[] };

const helpEn: FaqGroup[] = [
  {
    id: "account",
    title: "Account and sign-in",
    items: [
      { q: "How do I sign in?", a: "Use a code sent to your phone or email, your password, or Google. The same account works on kriraghor.com, esports and the app.", link: { href: "/sign-in", label: "Sign in" } },
      { q: "I forgot my password", a: "Reset it with a code sent to your phone or email. For your safety, every device is signed out and we send you an alert.", link: { href: "/sign-in/reset", label: "Reset your password" } },
      { q: "How do I verify my NID?", a: "Upload your NID in My account. You need it to sell used gear, open a business or withdraw winnings.", link: { href: "/account/verification", label: "Verification" } },
    ],
  },
  {
    id: "payments",
    title: "Payments and refunds",
    items: [
      { q: "How can I pay?", a: "bKash, Nagad or a card, online through our payment partner. Kriraghor never sees your card details." },
      { q: "Is my money safe?", a: "Yes. Kriraghor holds it and releases it only when you get what you paid for.", link: { href: "/buyer-protection", label: "Buyer protection" } },
      { q: "Where is my refund?", a: "Refunds go back to the way you paid. Your payments list in My account shows each refund and its status.", link: { href: "/me/payments", label: "My payments" } },
    ],
  },
  {
    id: "grounds",
    title: "Venues",
    items: [
      { q: "How do I book a venue?", a: "Open a venue, pick a day, court and time, then pay the advance or the full price online. The rest is paid at the venue.", link: { href: "/venues", label: "Find a venue" } },
      { q: "Can I cancel?", a: "Yes, from My bookings. If you cancel, the advance is not refunded. If the owner cancels, you get everything back.", link: { href: "/refund-policy", label: "Refund policy" } },
    ],
  },
  {
    id: "esports",
    title: "Esports",
    items: [
      { q: "How do I join a tournament?", a: "Verify your game UID, pay the entry fee, check in before the start, and the room ID appears for you shortly before the match." },
      { q: "How do I get my winnings?", a: "Prizes are added to your balance. Withdraw to bKash or Nagad once your NID is approved." },
      { q: "Someone cheated", a: "Report it from the tournament page with a video or screenshots.", link: { href: "/fair-play", label: "Fair play rules" } },
    ],
  },
  {
    id: "business",
    title: "Selling on Kriraghor",
    items: [
      { q: "How do I list my venue, shop or gym, or get hired?", a: "Start from Business in My account. Upload your documents, and our staff review them before your listing goes live.", link: { href: "/account/business", label: "Business documents" } },
      { q: "When do I get paid?", a: "When the service is delivered, minus Kriraghor's fee, to your verified bKash or Nagad account.", link: { href: "/me/payout-account", label: "Payout account" } },
    ],
  },
  {
    id: "problems",
    title: "Problems",
    items: [{ q: "Something went wrong", a: "Open a dispute from the booking, order or job, with photos or screenshots. The money stays held while staff review it.", link: { href: "/me/disputes", label: "My disputes" } }],
  },
];

const helpBn: FaqGroup[] = [
  {
    id: "account",
    title: "অ্যাকাউন্ট ও সাইন ইন",
    items: [
      { q: "কীভাবে সাইন ইন করব?", a: "ফোন বা ইমেইলে পাঠানো কোড, পাসওয়ার্ড অথবা গুগল দিয়ে। একই অ্যাকাউন্ট kriraghor.com, ই-স্পোর্টস ও অ্যাপে চলে।", link: { href: "/sign-in", label: "সাইন ইন" } },
      { q: "পাসওয়ার্ড ভুলে গেছি", a: "ফোন বা ইমেইলে পাঠানো কোড দিয়ে রিসেট করুন। নিরাপত্তার জন্য সব ডিভাইস থেকে সাইন আউট হবে এবং আমরা আপনাকে সতর্কবার্তা পাঠাব।", link: { href: "/sign-in/reset", label: "পাসওয়ার্ড রিসেট" } },
      { q: "NID কীভাবে যাচাই করব?", a: "আমার অ্যাকাউন্টে NID আপলোড করুন। পুরনো জিনিস বিক্রি, ব্যবসা খোলা বা পুরস্কারের টাকা তুলতে এটি লাগে।", link: { href: "/account/verification", label: "যাচাই" } },
    ],
  },
  {
    id: "payments",
    title: "পেমেন্ট ও রিফান্ড",
    items: [
      { q: "কীভাবে পেমেন্ট করব?", a: "বিকাশ, নগদ বা কার্ডে, আমাদের পেমেন্ট পার্টনারের মাধ্যমে অনলাইনে। ক্রীড়াঘর আপনার কার্ডের তথ্য দেখে না।" },
      { q: "আমার টাকা কি নিরাপদ?", a: "হ্যাঁ। ক্রীড়াঘর টাকা জমা রাখে এবং যা কিনেছেন তা পেলেই ছাড়ে।", link: { href: "/buyer-protection", label: "ক্রেতা সুরক্ষা" } },
      { q: "আমার রিফান্ড কোথায়?", a: "রিফান্ড সেই মাধ্যমেই ফেরত যায় যেভাবে পেমেন্ট করেছিলেন। আমার অ্যাকাউন্টের পেমেন্ট তালিকায় প্রতিটি রিফান্ড ও তার অবস্থা দেখা যায়।", link: { href: "/me/payments", label: "আমার পেমেন্ট" } },
    ],
  },
  {
    id: "grounds",
    title: "মাঠ",
    items: [
      { q: "কীভাবে ভেন্যু বুক করব?", a: "একটি ভেন্যু খুলে দিন, কোর্ট ও সময় বেছে নিন, তারপর অগ্রিম বা পুরো দাম অনলাইনে দিন। বাকিটা ভেন্যুতে দেবেন।", link: { href: "/venues", label: "ভেন্যু খুঁজুন" } },
      { q: "বাতিল করা যাবে?", a: "হ্যাঁ, আমার বুকিং থেকে। আপনি বাতিল করলে অগ্রিম ফেরত হয় না। মালিক বাতিল করলে সব টাকা ফেরত পাবেন।", link: { href: "/refund-policy", label: "রিফান্ড নীতি" } },
    ],
  },
  {
    id: "esports",
    title: "ই-স্পোর্টস",
    items: [
      { q: "কীভাবে টুর্নামেন্টে যোগ দেব?", a: "গেম UID যাচাই করুন, এন্ট্রি ফি দিন, শুরুর আগে চেক-ইন করুন; ম্যাচের কিছুক্ষণ আগে রুম আইডি আপনার জন্য খুলবে।" },
      { q: "পুরস্কারের টাকা কীভাবে পাব?", a: "পুরস্কার আপনার ব্যালান্সে যোগ হয়। NID অনুমোদনের পর বিকাশ বা নগদে তুলুন।" },
      { q: "কেউ চিটিং করেছে", a: "টুর্নামেন্টের পাতা থেকে ভিডিও বা স্ক্রিনশটসহ রিপোর্ট করুন।", link: { href: "/fair-play", label: "ফেয়ার প্লে নিয়ম" } },
    ],
  },
  {
    id: "business",
    title: "ক্রীড়াঘরে বিক্রি",
    items: [
      { q: "কীভাবে ভেন্যু, দোকান বা জিমের তালিকা দেব, বা হায়ার হব?", a: "আমার অ্যাকাউন্টের ব্যবসা অংশ থেকে শুরু করুন। কাগজপত্র আপলোড করুন; তালিকা চালুর আগে আমাদের কর্মীরা যাচাই করেন।", link: { href: "/account/business", label: "ব্যবসার কাগজপত্র" } },
      { q: "কখন টাকা পাব?", a: "সেবা দেওয়ার পর, ক্রীড়াঘরের ফি বাদে, আপনার যাচাই করা বিকাশ বা নগদ অ্যাকাউন্টে।", link: { href: "/me/payout-account", label: "পেআউট অ্যাকাউন্ট" } },
    ],
  },
  {
    id: "problems",
    title: "সমস্যা",
    items: [{ q: "কিছু একটা ভুল হয়েছে", a: "বুকিং, অর্ডার বা কাজ থেকে ছবি বা স্ক্রিনশটসহ অভিযোগ খুলুন। কর্মীরা দেখা পর্যন্ত টাকা জমা থাকে।", link: { href: "/me/disputes", label: "আমার অভিযোগ" } }],
  },
];

export const helpGroups = (locale: string) => (locale === "bn" ? helpBn : helpEn);
