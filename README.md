# ✈️ Trip Expense Tracker

### 🌐 Live Demo

**Application URL:**
https://trip-expense-tracker-cccf9.web.app/

> Manage group trip expenses, contributions, balances, and settlements in real time using Firebase and React.

---


---

## 🚀 Problem Statement

Managing money during trips can quickly become confusing:

* Who paid for what?
* How much has everyone spent?
* Who still owes money?
* How much money do I have left?
* Have all debts been settled?

Most groups rely on WhatsApp messages, notes, or manual calculations, which often lead to mistakes and disputes.

Trip Expense Tracker automates the entire process and provides complete transparency for every member.

---

## ✨ Key Features

### 🔐 Authentication

* Secure Firebase Authentication
* User Registration
* Login & Logout
* Persistent Sessions

### 👥 Group Management

* Create Trip Groups
* Join Existing Groups
* Manage Members
* Track Group Budget

### 💰 Expense Tracking

Add and categorize expenses:

* Food
* Transport
* Hotel
* Shopping
* Activities
* Miscellaneous

Each expense stores:

* Title
* Amount
* Category
* Date
* Creator
* Group Information

### 📊 Dashboard Analytics

Real-time trip insights:

* Total Budget
* Total Expenses
* Remaining Budget
* Total Members
* My Expenses
* Budget Usage
* Trip Status
* Top Contributors
* Recent Expenses

---

# 💳 My Balance System

The **My Balance** module is the financial engine of the application.

It answers:

* How much money have I contributed?
* How much have I spent?
* How much money do I still have?
* Am I owed money?
* Do I owe someone else?
* What is my fair share of the trip?

---

## 1️⃣ My Contribution

Represents the amount of money a member brought to the trip.

### Example

```text
Contribution = ₹7,000
```

This is not an expense.

It represents the personal trip budget available to the member.

---

## 2️⃣ My Expenses

Represents the total amount personally spent by the member.

### Example

```text
Food      ₹500
Auto      ₹200
Hotel     ₹1,400

Total     ₹2,100
```

---

## 3️⃣ Wallet Remaining

Shows how much money is still available with the member.

### Formula

```text
Wallet Remaining =
Contribution
− My Expenses
+ Settlements Received
− Settlements Paid
```

### Example

```text
Contribution = ₹7,000
Expenses     = ₹2,100

Wallet Remaining = ₹4,900
```

---

## 4️⃣ Fair Share

Represents how much each member should pay if all trip expenses are shared equally.

### Formula

```text
Fair Share =
Total Group Expenses
÷
Total Members
```

### Example

```text
Total Expenses = ₹5,180
Members        = 5

Fair Share     = ₹1,036
```

Meaning every member's expected trip cost is ₹1,036.

---

## 5️⃣ Settlement Balance

The most important metric.

It represents the difference between what a member actually paid and what they should have paid.

### Formula

```text
Settlement Balance =
My Expenses
− Fair Share
```

---

### Positive Balance

```text
My Expenses = ₹2,100
Fair Share  = ₹1,036

Balance     = +₹1,064
```

Meaning:

✅ Others owe me ₹1,064

---

### Negative Balance

```text
My Expenses = ₹500
Fair Share  = ₹1,036

Balance     = -₹536
```

Meaning:

✅ I owe others ₹536

---

# 🤝 Settlement Engine

The application automatically calculates who should pay whom.

### Example

| Member | Balance |
| ------ | ------- |
| Vishnu | +₹1,064 |
| Rahul  | -₹500   |
| Ajay   | -₹300   |
| Sai    | -₹264   |

Generated Settlement Suggestions:

```text
Rahul → Vishnu ₹500
Ajay  → Vishnu ₹300
Sai   → Vishnu ₹264
```

This minimizes the number of transactions required to settle all debts.

---

# 🔄 Settlement Workflow

### Step 1

System generates settlement suggestions.

```text
Rahul should pay Vishnu ₹500
```

### Step 2

Debtor sends a settlement request.

```text
Request Settlement
```

### Step 3

Request status becomes:

```text
Pending
```

### Step 4

Receiver verifies payment and accepts.

```text
Accept Payment
```

### Step 5

Request status becomes:

```text
Closed
```

### Step 6

Balances update automatically.

---

# 🏆 Contribution Leaderboard

Shows members ranked by their trip contributions.

### Example

```text
#1 Vishnu   ₹7,000
#2 Rahul    ₹5,000
#3 Ajay     ₹3,000
```

Provides transparency regarding trip funding.

---

# ✅ Business Rules Implemented

### Contribution ≠ Expense

Contribution and expenses are tracked separately.

```text
Contribution = Money brought to the trip
Expense      = Money spent during the trip
```

---

### Fair Cost Sharing

Every member ultimately pays an equal share of total expenses.

---

### Automated Settlements

The system automatically identifies:

* Who owes money
* Who should receive money
* Exact settlement amounts

---

### Partial Settlements Supported

Example:

```text
Debt      = ₹1,000
Paid      = ₹400
Remaining = ₹600
```

---

### Overpayment Protection

Users cannot settle more than the amount they owe.

---

### Duplicate Request Prevention

Duplicate settlement requests are blocked.

---

# 🛠 Tech Stack

## Frontend

* React
* Tailwind CSS
* Vite

## Backend

* Firebase

## Database

* Cloud Firestore

## Authentication

* Firebase Authentication

## Hosting

* Firebase Hosting

---

# 📈 Future Enhancements

* UPI Integration
* QR Code Payments
* Receipt Uploads
* Expense Export (PDF / Excel)
* Multi-Currency Support
* AI Budget Recommendations
* Trip Analytics Dashboard
* Expense Splitting by Category

---

# 🎯 Project Goal

Trip Expense Tracker aims to eliminate manual calculations, reduce financial confusion during group trips, and provide a transparent, real-time system for managing shared expenses and settlements.

Built to make group travel simple, fair, and stress-free.
