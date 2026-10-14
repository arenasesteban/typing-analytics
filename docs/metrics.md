# Typing Performance Metrics

This document is the canonical reference for the metrics used to evaluate performance in a **single completed typing test**. It defines how each metric is calculated and interpreted, including the effects of incorrect inputs, Backspace, and elapsed time. All measurements describe the test being evaluated; they are not aggregates across multiple sessions.

## 1. Counting and time conventions

A **character insertion** is one accepted `insert` event. Each insertion is an attempt at the character expected at its target position and is classified as correct or incorrect when it occurs. The attempt remains part of the metrics even if the character is subsequently removed with Backspace. A `backspace` event removes the latest active insertion but does not constitute another character attempt.

A session starts with its first accepted insertion and completes when an insertion fills the final position of the target text, **even if that insertion is incorrect**. The elapsed time is measured in milliseconds (`ms`) from the start of the session. The following values are used throughout the document:

| Term                  | Definition                                                               |
| --------------------- | ------------------------------------------------------------------------ |
| `totalInsertions`     | Number of accepted character insertions during the session.              |
| `correctInsertions`   | Insertions that matched the expected character at their target position. |
| `incorrectInsertions` | Insertions that did not match the expected character.                    |
| `durationMs`          | `completedAtMs - startedAtMs`.                                           |
| `elapsedMinutes`      | `durationMs / 60,000`.                                                   |

The total number of insertions includes both correct and incorrect attempts, including those later removed. Consequently, these metrics describe the user's **typing activity**, not merely the characters remaining when the test ends.

## 2. Completed-session metrics

The session summary provides the final evaluation of the test. Its established calculations remain authoritative.

| Metric          | Calculation                                   | Meaning                                                                                         |
| --------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Duration**    | `completedAtMs - startedAtMs`                 | Total elapsed time, in milliseconds, between the first accepted insertion and completion.       |
| **WPM**         | `(correctInsertions / 5) / elapsedMinutes`    | Typing speed based on correct insertion attempts, expressed as five-character words per minute. |
| **Raw WPM**     | `(totalInsertions / 5) / elapsedMinutes`      | Typing speed before discounting incorrect insertion attempts.                                   |
| **Accuracy**    | `(correctInsertions / totalInsertions) × 100` | Percentage of accepted insertions that were correct.                                            |
| **Consistency** | `100 / (1 + coefficientOfVariation)`          | Normalized measure of the variability in time between consecutive typing events.                |

### Consistency

Consistency uses the intervals between consecutive session events, **including Backspace events**. Given those intervals (`eventLatenciesMs`), the existing calculation is:

- `mean = average(eventLatenciesMs)`
- `variance = average((latency - mean)²)`
- `standardDeviation = √variance`
- `coefficientOfVariation = standardDeviation / mean`
- `consistency = 100 / (1 + coefficientOfVariation)`

Consistency ranges from **0 to 100**: values closer to 100 indicate less variation between consecutive event intervals. When there are no intervals, or their mean is zero, the established result is **100**. This is an existing metric; it does not introduce further latency statistics.

### Special cases

When `durationMs` is zero, **WPM and Raw WPM are 0** to avoid division by zero. Accuracy is **0** when there are no insertion attempts. Backspace never increases the insertion count, but it does participate in the existing event-interval calculation for Consistency.

## 3. Temporal typing speed

Temporal metrics show **how typing speed changes within the same test**. Every point is positioned on a relative time axis: `elapsedMs = timestampMs - startedAtMs`. The series report both cumulative performance and performance within fixed time windows.

| Metric                 | Calculation at elapsed time `t` or within a window              | Interpretation                                                            |
| ---------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Cumulative WPM**     | `(correctInsertionsThrough(t) / 5) / (t / 60,000)`              | Correct typing speed averaged from the beginning of the test through `t`. |
| **Cumulative Raw WPM** | `(totalInsertionsThrough(t) / 5) / (t / 60,000)`                | Overall insertion speed averaged from the beginning through `t`.          |
| **Window WPM**         | `(correctInsertionsInWindow / 5) / (windowDurationMs / 60,000)` | Correct typing speed during the selected time window.                     |
| **Window Raw WPM**     | `(totalInsertionsInWindow / 5) / (windowDurationMs / 60,000)`   | Overall insertion speed during the selected time window.                  |

The default window duration is **5,000 ms**. Windows are consecutive and do not overlap. The first window includes the insertion at elapsed time zero; an insertion exactly on a window's right boundary belongs to that window. If the test ends before a full window has elapsed, the final window uses its **actual shorter duration**. A window without insertions has WPM and Raw WPM equal to **0**, including during periods of inactivity.

The series begins with a **zero-valued point at `elapsedMs = 0`** to establish the visual baseline; that point does not represent an additional input. For a zero-duration session, it is the only temporal point. At the end of a session with positive duration, cumulative WPM and cumulative Raw WPM must agree with the corresponding completed-session summary values, within numerical tolerance. Metric values remain unrounded in the domain; rounding belongs to their presentation.

## 4. Incorrect inputs and corrections

Every incorrect insertion is preserved as an **error observation**. Its temporal marker identifies the original event, elapsed time, target position, expected character, and entered character. This makes it possible to locate the error in the test's progression, including after it has been removed.

An incorrect insertion is marked as **corrected** when a subsequent Backspace can be unambiguously associated with the removal of that particular insertion. In this context, _corrected_ means **removed with Backspace**; it does not mean that a correct replacement character was subsequently entered. Repeated incorrect attempts at the same position are separate observations, each with its own correction association when applicable. Both corrected and uncorrected errors remain included in the insertion counts, error rates, and temporal markers.

## 5. Character-level performance

Character-level metrics group attempts by the **expected character**, not by the character that was actually entered. They describe which target characters were harder to type during the evaluated session. Backspace adds no new attempt, and removing an insertion does not erase its contribution to the statistics.

For each expected character `c` with at least one observed attempt:

| Metric           | Calculation                                              | Meaning                                                        |
| ---------------- | -------------------------------------------------------- | -------------------------------------------------------------- |
| **Sample count** | `sampleCount(c) = correctInputs(c) + incorrectInputs(c)` | Total insertion attempts for the expected character.           |
| **Error count**  | `incorrectInputs(c)`                                     | Number of incorrect attempts for that character.               |
| **Error Rate**   | `(incorrectInputs(c) / sampleCount(c)) × 100`            | Percentage of attempts for that character that were incorrect. |
| **Accuracy**     | `(correctInputs(c) / sampleCount(c)) × 100`              | Percentage of attempts for that character that were correct.   |

Error Rate and Accuracy are complementary for each observed character: **`Error Rate + Accuracy = 100%`**. Characters without attempts do not appear in these statistics.

### Problematic-character classification

A character is classified as problematic only when **both** conditions are satisfied:

- **Minimum sample:** `sampleCount(c) ≥ 5`.
- **Error threshold:** `ErrorRate(c) ≥ 30%`.

Both comparisons are inclusive. The minimum sample and error threshold are explicit, configurable domain rules; **5 attempts and 30%** are their initial values.

| Classification | Meaning                                                        |
| -------------- | -------------------------------------------------------------- |
| `true`         | Sufficient sample and an Error Rate at or above the threshold. |
| `false`        | Sufficient sample and an Error Rate below the threshold.       |
| `null`         | Insufficient sample to classify the character.                 |

For example, five attempts at the expected character `a`, with two incorrect insertions, produce an **Error Rate of 40%** and **Accuracy of 60%**, so `a` is classified as problematic under the default policy. With only four attempts, its classification remains `null` regardless of the observed Error Rate. **Insufficient evidence must not be interpreted as satisfactory performance.**

## 6. Interpretation boundaries

All values are derived from the events of **one completed test** and its exact target text. Corrected attempts remain part of the historical performance measured in that test; therefore, WPM, Raw WPM, and Accuracy must not be interpreted as measures of only the final, unremoved text. Character classifications express evidence within the current test rather than a persistent judgment about the user's ability.

Event timestamps are used for elapsed time, temporal speed, error placement, and the existing Consistency metric. **Latency median, P95, and latency distributions are not part of this evaluation.**
