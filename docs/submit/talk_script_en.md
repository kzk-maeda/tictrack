# TicTrack Demo Video Talk Script

> **Duration**: 3–4 minutes
> **Format**: Screen recording + narration (English)
> **Audience**: AWS 10,000 AIdeas Competition judges / community voters

---

## 1. Opening — The Problem (~40s)

**[Screen: TicTrack logo → Login screen]**

Hi. I'd like to introduce TicTrack.

Let me share my story.

My son has tic symptoms.
One day, out of nowhere, he started blinking more frequently and shaking his head in ways I hadn't seen before.
"When did this start?" "How often is it happening?"
I tried to keep track, but in the moment my hands were full — and by the time I tried to recall later, the details had already faded.
Even at the doctor's office, I couldn't explain it well.
That frustration stayed with me.

It turns out that 1 in 5 children experience some form of tic while growing up.
It's far from rare — yet there are almost no tools designed to support caregivers in tracking these symptoms.

TicTrack is the app I built to solve this problem — an app made for caregivers.

---

## 2. Getting Started (~15s)

**[Screen: Auth screen → Sign up → Add child in settings]**

Getting started is simple.
TicTrack is a PWA that runs in the browser, so there's no need to install anything from an app store.
Sign up with your email and register your child's name and birth month — that's all it takes.
There's also a demo mode, so you can try the app before creating an account.

---

## 3. Tic Cards for One-Tap Logging (~30s)

**[Screen: Tic card management → Add form → Select type, symptom, severity]**

First, you register the tic symptoms you've observed in your child as "Tic Cards."
You set whether it's a motor or vocal tic, the specific symptom name, and the severity.

**[Screen: Tic card list → One-tap log button]**

Each card has a "Log" button — one tap is all it takes to record when and what happened.
The interface is designed to work on smartphones, so even during meals, on the school run, or while putting your child to bed, you can log it instantly with one hand.

But not every symptom can be pre-registered as a card.
When a new symptom appears, or a movement that's hard to put into words — that's where TicTrack's core feature comes in.

---

## 4. Video Recording & AI Auto-Labeling (~60s)

**[Screen: Highlight "Record Video" button in the header]**

Accurately describing tic symptoms in words is extremely difficult for caregivers without medical expertise.
"How do I even describe that movement?" — AI solves this problem.

Video recording is also available from the "Video Input" tab on the Events page, but symptoms can happen at any time.
That's why we've placed a "Record Video" button in the header — always visible on every screen — so you can start recording the moment you notice something.

**[Screen: Capture screen → Recording → Countdown → Preview → Save]**

Recording is capped at 20 seconds. A short clip is all you need.
You can record directly from your camera, and once saved, the video is securely uploaded to the cloud.

**[Screen: Timeline → Start AI analysis → Results displayed]**

Tap "Start AI Analysis," and Amazon Bedrock's Nova Pro model analyzes the video, automatically suggesting structured labels for the symptoms.
Symptom name, motor or vocal, simple or complex, severity, confidence level, and timestamped observations.
The symptoms that caregivers struggled to put into words — AI transforms them into structured information that medical professionals can understand.

Of course, final review and corrections are made by the caregiver. AI only suggests — it does not diagnose.
There's also a feedback feature, so the AI's accuracy can be continuously improved over time.

**Known symptoms with one tap. New symptoms with video + AI.**
By combining these two methods of recording, caregivers can keep tracking effortlessly in their daily lives.

---

## 5. Reviewing Records on the Timeline (~20s)

**[Screen: Timeline page → Calendar → Tap date → Daily list]**

On the timeline, record counts appear as badges on the calendar.
Tap a date to see one-tap logs and video recordings listed chronologically.
You can play back videos and review AI analysis results right from this screen.

---

## 6. Medications & Life Events (~25s)

**[Screen: Medications page → Life events tab]**

Tic symptoms can be related to medication changes or shifts in a child's environment.
With TicTrack, you can log medication intake with one tap and record life events like school transfers or relocations along with their stress levels.
By capturing not just symptoms but the context behind them, you can later look back and understand why changes occurred during certain periods.

---

## 7. Dashboard — Spotting Trends (~30s)

**[Screen: Dashboard page → Stat cards → Charts]**

The dashboard visualizes your recorded data statistically.
Total episodes, days recorded, daily average, and the most frequent tic.
Charts for type distribution, severity distribution, time-of-day patterns, and more let you grasp trends at a glance.

It's designed around the reality that you can't watch your child 24/7 — it reads trends and changes from whatever you were able to record.

And this information can be used directly when visiting a medical professional.
When the doctor asks "How have things been lately?", instead of relying on memory, you can explain with data.
It changes the quality of the conversation with your doctor.

---

## 8. Closing (~15s)

**[Screen: TicTrack logo / Top screen]**

TicTrack is an app that reduces anxiety for caregivers facing their child's tic symptoms, while keeping the burden of recording to an absolute minimum.
It's okay to miss things. From what you were able to capture, AI helps articulate the symptoms and understand the trends.
That's the TicTrack approach.

Thank you for watching.
