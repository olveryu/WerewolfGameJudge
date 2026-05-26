# Offline Gameplay SOP (Night 1 Electronic Judge)

## Product Positioning

This App is designed specifically for **offline same-table, multi-device** scenarios, responsible only for the **Night 1 electronic judge** role. The Host is also a player and should close their eyes during the night while the App automatically plays voice-guided flow.

---

## 1. Game Setup

### 1.1 Create Room (Host)

1. Host opens the App, taps "创建房间"
2. Selects a game board (role configuration), confirms player count
3. Generates a 4-digit room code, shares it with other players

### 1.2 Join Room (Player)

1. Player opens the App, taps "进入房间"
2. Enters the 4-digit room code
3. Taps a seat to sit down (seats 1-12)

### 1.3 Assign Roles

1. Once everyone is seated, Host taps "准备查看身份"
2. System automatically assigns roles
3. Each player taps "查看身份" to confirm their role
4. After everyone confirms, Host taps "开始游戏"

---

## 2. Night 1 Flow Overview

Night 1 flow is entirely guided by automatic voice playback from the App:

```
🌙 Night begins voice
    ↓
🐺 Wolf action voice → Wolf players select target
    ↓
🔮 Seer action voice → Seer selects investigation target
    ↓
🧙 Witch action voice → Witch decides whether to use potions
    ↓
... Continues per board configuration ...
    ↓
☀️ Night 1 end voice
    ↓
📢 Host screen shows last night's results (death/peaceful night)
```

**Note**: Daytime phase is conducted by players themselves (speeches, voting, etc.). The App is only responsible for Night 1.

---

## 3. Audio Anomaly Notes

### Normal Behavior

The App automatically plays each role's action voice sequentially. After each voice segment finishes, it waits for the corresponding player's action.

### Exception Handling (Built-in Safeguards)

- **Missing audio file**: Skips that voice segment, continues to next step
- **Playback failure/interruption**: Auto-skips, won't freeze the flow
- **Playback timeout (15 seconds)**: Automatically gives up waiting, continues flow

> ✅ Audio issues will not freeze the game.

### Situations That May Still Block

- **Player doesn't act**: A player never taps to select their target
- **Device locks/backgrounds**: Player's phone locks, preventing action submission

These require offline communication or using "Restart" to resolve.

---

## 4. Stuck / Restart Handling

### 4.1 When Is a Restart Needed?

- A role's action phase has no progress for an extended time (e.g., 2+ minutes)
- A player reports device issues or App unresponsiveness
- Someone misclicks causing flow confusion

### 4.2 Offline Handling Steps

1. **Everyone calls stop** — Someone notices the issue and verbally calls stop
2. **Declare game void** — Host announces: "This round is void, let's restart"
3. **Everyone opens eyes** — Current identities are no longer secret

### 4.3 Host Restart Operation

1. Host finds the "重开" (Restart) button on screen
2. Taps it to trigger a confirmation dialog
3. System automatically:
   - Clears all night action records
   - **Clears role assignments** (does not immediately re-deal)
   - Returns to "Seated" state

### 4.4 After Restart

1. Host taps "准备查看身份" to re-shuffle and assign roles
2. All players tap "查看身份" again to confirm new roles
3. Host taps "开始游戏"
4. Re-enters Night 1

---

## 5. Risk & Fairness Statement

### About Restarting

- 🚨 **Restarting re-deals identities** — it does not restore original identities
- 🚫 **Not for error correction**: If someone misreads their role or misclicks, restart should not be used to "fix" it
- ✅ **Only for true restarts**: Use only when genuinely stuck and unable to continue

### Permission Notes

- Only Host can see the "重新开始" button
- Only Host can execute a restart
- Recommended: Host verbally gets everyone's agreement before restarting

---

## 6. FAQ

### Q1: No sound — what to do?

**A:** Check the following:

1. Is the phone on silent / volume turned down?
2. Does the App have audio permissions?
3. If still no sound, the flow won't freeze (has fallback). Host can verbally announce the current acting role.

### Q2: Someone won't tap their action — what to do?

**A:**

1. Verbally remind the player offline to take their action
2. If device has issues, Host can use "重新开始"
3. If intentionally refusing to act, resolve through offline negotiation

### Q3: Want to change board/role configuration?

**A:**

1. Before game starts: Host taps "⚙️ 设置" to modify the board
2. During game: Must first use "重新开始", then modify
