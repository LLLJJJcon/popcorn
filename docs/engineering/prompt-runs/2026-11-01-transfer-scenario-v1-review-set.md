
# transfer-scenario-v1 fixed review set — 2026-11-01T10:45:28.560Z

Fixed synthetic card inputs; real generated outputs require human review. Usable structured results: 20/20. Total format attempts: 20. Human approval: pending (required at least 17/20). Failed cases remain in denominator 20; no replacement cases and no semantic retries. Existing transport retries remain unchanged. No account configuration or raw provider errors are included.

| Case | Expression | Direction | Intention | Setting | Structured result | Human intention/setting | Human naturalness | Approved |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| review-01 | 高得要命 | near | complain | casual_chat | available | pending | pending | pending |
| review-02 | 高得要命 | far | complain | online_social | available | pending | pending | pending |
| review-03 | 高得要命 | near | complain | casual_chat | available | pending | pending | pending |
| review-04 | 说白了 | near | explain_sum_up | work_school | available | pending | pending | pending |
| review-05 | 说白了 | far | explain_sum_up | casual_chat | available | pending | pending | pending |
| review-06 | 说白了 | near | explain_sum_up | work_school | available | pending | pending | pending |
| review-07 | 话虽如此 | near | concede_contrast | work_school | available | pending | pending | pending |
| review-08 | 话虽如此 | far | concede_contrast | casual_chat | available | pending | pending | pending |
| review-09 | 话虽如此 | near | concede_contrast | work_school | available | pending | pending | pending |
| review-10 | 太夸张了 | far | emphasize | online_social | available | pending | pending | pending |
| review-11 | 真没想到 | near | react | daily_errands | available | pending | pending | pending |
| review-12 | 不妨 | far | suggest | formal_writing | available | pending | pending | pending |
| review-13 | 除此之外 | near | connect_ideas | formal_writing | available | pending | pending | pending |
| review-14 | 井井有条 | near | describe | work_school | available | pending | pending | pending |
| review-15 | 久违了 | far | other | casual_chat | available | pending | pending | pending |
| review-16 | 有两把刷子 | near | praise | casual_chat | available | pending | pending | pending |
| review-17 | 划不来 | far | complain | daily_errands | available | pending | pending | pending |
| review-18 | 归根结底 | far | explain_sum_up | formal_writing | available | pending | pending | pending |
| review-19 | 退一步说 | far | concede_contrast | work_school | available | pending | pending | pending |
| review-20 | 活灵活现 | far | describe | online_social | available | pending | pending | pending |

## review-01

Input and expectations:

```json
{
  "input": {
    "task": "review_situation",
    "card": {
      "expression": "高得要命",
      "meaningHere": "Ridiculously high — complaining the price is way too much.",
      "useItWhen": "When you want to complain that something is excessive and exaggerate a little.",
      "toneAndWho": "Casual and exaggerated; natural with friends and online."
    },
    "targetFunction": {
      "value": "complain",
      "label": "Complain",
      "rule": "Something annoying, unfair or costly has happened and the speaker needs to express dissatisfaction."
    },
    "targetSetting": {
      "value": "casual_chat",
      "label": "Casual chat",
      "description": "Chatting with friends or family, or sending private messages."
    },
    "transferType": "near",
    "previousSituations": [
      "朋友问：“这杯咖啡六十元，你怎么看？”"
    ]
  },
  "expect": {
    "mustNotContain": [
      "高得要命"
    ],
    "maxCharacters": {
      "situationZh": 120,
      "interlocutor": 10
    },
    "maxWords": {
      "situationEn": 60,
      "taskEn": 30
    },
    "manualReview": [
      "Judge intention, expression sense, setting and Chinese naturalness.",
      "A later case also receives successful generated situations from earlier cases for this expression.",
      "Faithful English translation; neither the situation nor task reveals or translates answer wording."
    ]
  }
}
```

All attempts:

```json
{
  "number": 1,
  "status": "valid",
  "output": {
    "situationZh": "朋友发来消息：“我刚看了那家新开的火锅店，一个人吃要三百块！你觉得贵不贵？”",
    "situationEn": "A friend messages you: \"I just checked that new hotpot place, it costs three hundred yuan per person! What do you think, is it expensive?\"",
    "interlocutor": "朋友",
    "taskEn": "Reply to your friend in a casual chat, expressing your strong dissatisfaction that the price is excessive."
  },
  "comparison": {
    "checks": [
      {
        "label": "valid four-field scenario",
        "passed": true
      },
      {
        "label": "no extra model-owned fields",
        "passed": true
      },
      {
        "label": "target-free and previously unused scenario",
        "passed": true
      },
      {
        "label": "situationZh excludes 高得要命",
        "passed": true
      },
      {
        "label": "situationEn excludes 高得要命",
        "passed": true
      },
      {
        "label": "interlocutor excludes 高得要命",
        "passed": true
      },
      {
        "label": "taskEn excludes 高得要命",
        "passed": true
      }
    ],
    "manualReview": [
      "Judge intention, expression sense, setting and Chinese naturalness.",
      "A later case also receives successful generated situations from earlier cases for this expression.",
      "Faithful English translation; neither the situation nor task reveals or translates answer wording.",
      "A human must assess naturalness, intended meaning, reusable boundaries and genuinely different situations; passing these checks is not semantic acceptance."
    ]
  }
}
```

Selected result: first structurally valid attempt.

Human intention/setting/naturalness: pending.

## review-02

Input and expectations:

```json
{
  "input": {
    "task": "review_situation",
    "card": {
      "expression": "高得要命",
      "meaningHere": "Ridiculously high — complaining the price is way too much.",
      "useItWhen": "When you want to complain that something is excessive and exaggerate a little.",
      "toneAndWho": "Casual and exaggerated; natural with friends and online."
    },
    "targetFunction": {
      "value": "complain",
      "label": "Complain",
      "rule": "Something annoying, unfair or costly has happened and the speaker needs to express dissatisfaction."
    },
    "targetSetting": {
      "value": "online_social",
      "label": "Online posts",
      "description": "Writing posts, comments, group-chat messages or bullet comments."
    },
    "transferType": "far",
    "previousSituations": [
      "朋友问：“这杯咖啡六十元，你怎么看？”",
      "朋友发来消息：“我刚看了那家新开的火锅店，一个人吃要三百块！你觉得贵不贵？”"
    ]
  },
  "expect": {
    "mustNotContain": [
      "高得要命"
    ],
    "maxCharacters": {
      "situationZh": 120,
      "interlocutor": 10
    },
    "maxWords": {
      "situationEn": 60,
      "taskEn": 30
    },
    "manualReview": [
      "Judge intention, expression sense, setting and Chinese naturalness.",
      "A later case also receives successful generated situations from earlier cases for this expression.",
      "Faithful English translation; neither the situation nor task reveals or translates answer wording."
    ]
  }
}
```

All attempts:

```json
{
  "number": 1,
  "status": "valid",
  "output": {
    "situationZh": "你在网上买的耳机到货了，价格比你之前看到的贵了一大截，还多收了运费。你想在购物群里吐槽一下。同事问：“你的新耳机怎么样？”",
    "situationEn": "The headphones you bought online have arrived. They cost much more than the price you saw earlier, and shipping was also charged. You want to vent in the shopping group. A coworker asks: \"How are your new headphones?\"",
    "interlocutor": "同事",
    "taskEn": "Write a short online group-chat reply to your coworker expressing your dissatisfaction with the price and shipping fee."
  },
  "comparison": {
    "checks": [
      {
        "label": "valid four-field scenario",
        "passed": true
      },
      {
        "label": "no extra model-owned fields",
        "passed": true
      },
      {
        "label": "target-free and previously unused scenario",
        "passed": true
      },
      {
        "label": "situationZh excludes 高得要命",
        "passed": true
      },
      {
        "label": "situationEn excludes 高得要命",
        "passed": true
      },
      {
        "label": "interlocutor excludes 高得要命",
        "passed": true
      },
      {
        "label": "taskEn excludes 高得要命",
        "passed": true
      }
    ],
    "manualReview": [
      "Judge intention, expression sense, setting and Chinese naturalness.",
      "A later case also receives successful generated situations from earlier cases for this expression.",
      "Faithful English translation; neither the situation nor task reveals or translates answer wording.",
      "A human must assess naturalness, intended meaning, reusable boundaries and genuinely different situations; passing these checks is not semantic acceptance."
    ]
  }
}
```

Selected result: first structurally valid attempt.

Human intention/setting/naturalness: pending.

## review-03

Input and expectations:

```json
{
  "input": {
    "task": "review_situation",
    "card": {
      "expression": "高得要命",
      "meaningHere": "Ridiculously high — complaining the price is way too much.",
      "useItWhen": "When you want to complain that something is excessive and exaggerate a little.",
      "toneAndWho": "Casual and exaggerated; natural with friends and online."
    },
    "targetFunction": {
      "value": "complain",
      "label": "Complain",
      "rule": "Something annoying, unfair or costly has happened and the speaker needs to express dissatisfaction."
    },
    "targetSetting": {
      "value": "casual_chat",
      "label": "Casual chat",
      "description": "Chatting with friends or family, or sending private messages."
    },
    "transferType": "near",
    "previousSituations": [
      "朋友问：“这杯咖啡六十元，你怎么看？”",
      "朋友发来消息：“我刚看了那家新开的火锅店，一个人吃要三百块！你觉得贵不贵？”",
      "你在网上买的耳机到货了，价格比你之前看到的贵了一大截，还多收了运费。你想在购物群里吐槽一下。同事问：“你的新耳机怎么样？”"
    ]
  },
  "expect": {
    "mustNotContain": [
      "高得要命"
    ],
    "maxCharacters": {
      "situationZh": 120,
      "interlocutor": 10
    },
    "maxWords": {
      "situationEn": 60,
      "taskEn": 30
    },
    "manualReview": [
      "Judge intention, expression sense, setting and Chinese naturalness.",
      "A later case also receives successful generated situations from earlier cases for this expression.",
      "Faithful English translation; neither the situation nor task reveals or translates answer wording."
    ]
  }
}
```

All attempts:

```json
{
  "number": 1,
  "status": "valid",
  "output": {
    "situationZh": "周末我和朋友去逛夜市，买了一份烤鸡翅，老板要价一百二十块。朋友问：“你觉得这个价格合理吗？”",
    "situationEn": "On the weekend, you and a friend went to a night market and bought a plate of grilled chicken wings. The vendor charged 120 yuan. Your friend asks, \"Do you think that price is reasonable?\"",
    "interlocutor": "朋友",
    "taskEn": "Reply to your friend in casual chat, saying how you feel about the price of the chicken wings and why."
  },
  "comparison": {
    "checks": [
      {
        "label": "valid four-field scenario",
        "passed": true
      },
      {
        "label": "no extra model-owned fields",
        "passed": true
      },
      {
        "label": "target-free and previously unused scenario",
        "passed": true
      },
      {
        "label": "situationZh excludes 高得要命",
        "passed": true
      },
      {
        "label": "situationEn excludes 高得要命",
        "passed": true
      },
      {
        "label": "interlocutor excludes 高得要命",
        "passed": true
      },
      {
        "label": "taskEn excludes 高得要命",
        "passed": true
      }
    ],
    "manualReview": [
      "Judge intention, expression sense, setting and Chinese naturalness.",
      "A later case also receives successful generated situations from earlier cases for this expression.",
      "Faithful English translation; neither the situation nor task reveals or translates answer wording.",
      "A human must assess naturalness, intended meaning, reusable boundaries and genuinely different situations; passing these checks is not semantic acceptance."
    ]
  }
}
```

Selected result: first structurally valid attempt.

Human intention/setting/naturalness: pending.

## review-04

Input and expectations:

```json
{
  "input": {
    "task": "review_situation",
    "card": {
      "expression": "说白了",
      "meaningHere": "To put it plainly, giving the central point.",
      "useItWhen": "When someone has not understood or a discussion needs a plain summary.",
      "toneAndWho": "Direct but acceptable with colleagues and classmates."
    },
    "targetFunction": {
      "value": "explain_sum_up",
      "label": "Explain · Sum up",
      "rule": "The other person has not understood, or a discussion needs to be summed up."
    },
    "targetSetting": {
      "value": "work_school",
      "label": "Work & school",
      "description": "Talking with colleagues, managers, teachers or classmates, including meetings and class."
    },
    "transferType": "near",
    "previousSituations": [
      "同事问：“会议讨论了这么久，大家到底想解决什么问题？”"
    ]
  },
  "expect": {
    "mustNotContain": [
      "说白了"
    ],
    "maxCharacters": {
      "situationZh": 120,
      "interlocutor": 10
    },
    "maxWords": {
      "situationEn": 60,
      "taskEn": 30
    },
    "manualReview": [
      "Judge intention, expression sense, setting and Chinese naturalness.",
      "A later case also receives successful generated situations from earlier cases for this expression.",
      "Faithful English translation; neither the situation nor task reveals or translates answer wording."
    ]
  }
}
```

All attempts:

```json
{
  "number": 1,
  "status": "valid",
  "output": {
    "situationZh": "项目会议开了一个小时，大家讨论来讨论去，我还是没听明白这次要不要换供应商。你能用简单的话帮我总结一下吗？",
    "situationEn": "The project meeting lasted an hour, and everyone kept going around in circles. I still don't understand whether we should switch suppliers this time. Can you summarize it in simple terms for me?",
    "interlocutor": "同事小王",
    "taskEn": "Reply to your colleague Xiao Wang and give a short, plain summary of the main point of the discussion in one or two sentences."
  },
  "comparison": {
    "checks": [
      {
        "label": "valid four-field scenario",
        "passed": true
      },
      {
        "label": "no extra model-owned fields",
        "passed": true
      },
      {
        "label": "target-free and previously unused scenario",
        "passed": true
      },
      {
        "label": "situationZh excludes 说白了",
        "passed": true
      },
      {
        "label": "situationEn excludes 说白了",
        "passed": true
      },
      {
        "label": "interlocutor excludes 说白了",
        "passed": true
      },
      {
        "label": "taskEn excludes 说白了",
        "passed": true
      }
    ],
    "manualReview": [
      "Judge intention, expression sense, setting and Chinese naturalness.",
      "A later case also receives successful generated situations from earlier cases for this expression.",
      "Faithful English translation; neither the situation nor task reveals or translates answer wording.",
      "A human must assess naturalness, intended meaning, reusable boundaries and genuinely different situations; passing these checks is not semantic acceptance."
    ]
  }
}
```

Selected result: first structurally valid attempt.

Human intention/setting/naturalness: pending.

## review-05

Input and expectations:

```json
{
  "input": {
    "task": "review_situation",
    "card": {
      "expression": "说白了",
      "meaningHere": "To put it plainly, giving the central point.",
      "useItWhen": "When someone has not understood or a discussion needs a plain summary.",
      "toneAndWho": "Direct but acceptable with colleagues and classmates."
    },
    "targetFunction": {
      "value": "explain_sum_up",
      "label": "Explain · Sum up",
      "rule": "The other person has not understood, or a discussion needs to be summed up."
    },
    "targetSetting": {
      "value": "casual_chat",
      "label": "Casual chat",
      "description": "Chatting with friends or family, or sending private messages."
    },
    "transferType": "far",
    "previousSituations": [
      "同事问：“会议讨论了这么久，大家到底想解决什么问题？”",
      "项目会议开了一个小时，大家讨论来讨论去，我还是没听明白这次要不要换供应商。你能用简单的话帮我总结一下吗？"
    ]
  },
  "expect": {
    "mustNotContain": [
      "说白了"
    ],
    "maxCharacters": {
      "situationZh": 120,
      "interlocutor": 10
    },
    "maxWords": {
      "situationEn": 60,
      "taskEn": 30
    },
    "manualReview": [
      "Judge intention, expression sense, setting and Chinese naturalness.",
      "A later case also receives successful generated situations from earlier cases for this expression.",
      "Faithful English translation; neither the situation nor task reveals or translates answer wording."
    ]
  }
}
```

All attempts:

```json
{
  "number": 1,
  "status": "valid",
  "output": {
    "situationZh": "我和朋友聊了半天投资，我还是听不懂那个基金到底好不好。你能用简单的话给我讲讲重点吗？",
    "situationEn": "I chatted with a friend about investing for ages, but I still don't understand whether that fund is good. Can you give me the main points in simple words?",
    "interlocutor": "朋友",
    "taskEn": "Reply to your friend in casual Chinese, giving the central point of the fund in plain, simple words."
  },
  "comparison": {
    "checks": [
      {
        "label": "valid four-field scenario",
        "passed": true
      },
      {
        "label": "no extra model-owned fields",
        "passed": true
      },
      {
        "label": "target-free and previously unused scenario",
        "passed": true
      },
      {
        "label": "situationZh excludes 说白了",
        "passed": true
      },
      {
        "label": "situationEn excludes 说白了",
        "passed": true
      },
      {
        "label": "interlocutor excludes 说白了",
        "passed": true
      },
      {
        "label": "taskEn excludes 说白了",
        "passed": true
      }
    ],
    "manualReview": [
      "Judge intention, expression sense, setting and Chinese naturalness.",
      "A later case also receives successful generated situations from earlier cases for this expression.",
      "Faithful English translation; neither the situation nor task reveals or translates answer wording.",
      "A human must assess naturalness, intended meaning, reusable boundaries and genuinely different situations; passing these checks is not semantic acceptance."
    ]
  }
}
```

Selected result: first structurally valid attempt.

Human intention/setting/naturalness: pending.

## review-06

Input and expectations:

```json
{
  "input": {
    "task": "review_situation",
    "card": {
      "expression": "说白了",
      "meaningHere": "To put it plainly, giving the central point.",
      "useItWhen": "When someone has not understood or a discussion needs a plain summary.",
      "toneAndWho": "Direct but acceptable with colleagues and classmates."
    },
    "targetFunction": {
      "value": "explain_sum_up",
      "label": "Explain · Sum up",
      "rule": "The other person has not understood, or a discussion needs to be summed up."
    },
    "targetSetting": {
      "value": "work_school",
      "label": "Work & school",
      "description": "Talking with colleagues, managers, teachers or classmates, including meetings and class."
    },
    "transferType": "near",
    "previousSituations": [
      "同事问：“会议讨论了这么久，大家到底想解决什么问题？”",
      "项目会议开了一个小时，大家讨论来讨论去，我还是没听明白这次要不要换供应商。你能用简单的话帮我总结一下吗？",
      "我和朋友聊了半天投资，我还是听不懂那个基金到底好不好。你能用简单的话给我讲讲重点吗？"
    ]
  },
  "expect": {
    "mustNotContain": [
      "说白了"
    ],
    "maxCharacters": {
      "situationZh": 120,
      "interlocutor": 10
    },
    "maxWords": {
      "situationEn": 60,
      "taskEn": 30
    },
    "manualReview": [
      "Judge intention, expression sense, setting and Chinese naturalness.",
      "A later case also receives successful generated situations from earlier cases for this expression.",
      "Faithful English translation; neither the situation nor task reveals or translates answer wording."
    ]
  }
}
```

All attempts:

```json
{
  "number": 1,
  "status": "valid",
  "output": {
    "situationZh": "班会讨论了很久，同学们观点很多，我还是不知道大家最后决定了什么。你能简单说一下结论吗？",
    "situationEn": "The class meeting discussed things for a long time, and everyone had many opinions, but I still don't know what the group finally decided. Can you briefly tell me the conclusion?",
    "interlocutor": "同学",
    "taskEn": "Reply to your classmate by giving the central point of the discussion in one or two plain sentences."
  },
  "comparison": {
    "checks": [
      {
        "label": "valid four-field scenario",
        "passed": true
      },
      {
        "label": "no extra model-owned fields",
        "passed": true
      },
      {
        "label": "target-free and previously unused scenario",
        "passed": true
      },
      {
        "label": "situationZh excludes 说白了",
        "passed": true
      },
      {
        "label": "situationEn excludes 说白了",
        "passed": true
      },
      {
        "label": "interlocutor excludes 说白了",
        "passed": true
      },
      {
        "label": "taskEn excludes 说白了",
        "passed": true
      }
    ],
    "manualReview": [
      "Judge intention, expression sense, setting and Chinese naturalness.",
      "A later case also receives successful generated situations from earlier cases for this expression.",
      "Faithful English translation; neither the situation nor task reveals or translates answer wording.",
      "A human must assess naturalness, intended meaning, reusable boundaries and genuinely different situations; passing these checks is not semantic acceptance."
    ]
  }
}
```

Selected result: first structurally valid attempt.

Human intention/setting/naturalness: pending.

## review-07

Input and expectations:

```json
{
  "input": {
    "task": "review_situation",
    "card": {
      "expression": "话虽如此",
      "meaningHere": "Even so, accepting a point before offering a different view.",
      "useItWhen": "When you acknowledge a reasonable point and then contrast it with another concern.",
      "toneAndWho": "Measured disagreement with colleagues and classmates."
    },
    "targetFunction": {
      "value": "concede_contrast",
      "label": "Concede · Contrast",
      "rule": "The speaker needs to accept one point the other person makes and then offer a different view."
    },
    "targetSetting": {
      "value": "work_school",
      "label": "Work & school",
      "description": "Talking with colleagues, managers, teachers or classmates, including meetings and class."
    },
    "transferType": "near",
    "previousSituations": [
      "同事说：“这个方案成本低，所以我们现在就做吧？”"
    ]
  },
  "expect": {
    "mustNotContain": [
      "话虽如此"
    ],
    "maxCharacters": {
      "situationZh": 120,
      "interlocutor": 10
    },
    "maxWords": {
      "situationEn": 60,
      "taskEn": 30
    },
    "manualReview": [
      "Judge intention, expression sense, setting and Chinese naturalness.",
      "A later case also receives successful generated situations from earlier cases for this expression.",
      "Faithful English translation; neither the situation nor task reveals or translates answer wording."
    ]
  }
}
```

All attempts:

```json
{
  "number": 1,
  "status": "valid",
  "output": {
    "situationZh": "同事说：“这个方案成本低，我觉得可以先试一下。”你觉得成本确实不高，但担心它的效果还没有验证。",
    "situationEn": "A colleague says: \"This plan is low-cost, so I think we can try it first.\" You agree the cost is not high, but you worry its effect has not been verified yet.",
    "interlocutor": "同事",
    "taskEn": "Reply to your colleague by accepting that the cost is low, then offer your different concern about verifying the effect first."
  },
  "comparison": {
    "checks": [
      {
        "label": "valid four-field scenario",
        "passed": true
      },
      {
        "label": "no extra model-owned fields",
        "passed": true
      },
      {
        "label": "target-free and previously unused scenario",
        "passed": true
      },
      {
        "label": "situationZh excludes 话虽如此",
        "passed": true
      },
      {
        "label": "situationEn excludes 话虽如此",
        "passed": true
      },
      {
        "label": "interlocutor excludes 话虽如此",
        "passed": true
      },
      {
        "label": "taskEn excludes 话虽如此",
        "passed": true
      }
    ],
    "manualReview": [
      "Judge intention, expression sense, setting and Chinese naturalness.",
      "A later case also receives successful generated situations from earlier cases for this expression.",
      "Faithful English translation; neither the situation nor task reveals or translates answer wording.",
      "A human must assess naturalness, intended meaning, reusable boundaries and genuinely different situations; passing these checks is not semantic acceptance."
    ]
  }
}
```

Selected result: first structurally valid attempt.

Human intention/setting/naturalness: pending.

## review-08

Input and expectations:

```json
{
  "input": {
    "task": "review_situation",
    "card": {
      "expression": "话虽如此",
      "meaningHere": "Even so, accepting a point before offering a different view.",
      "useItWhen": "When you acknowledge a reasonable point and then contrast it with another concern.",
      "toneAndWho": "Measured disagreement with colleagues and classmates."
    },
    "targetFunction": {
      "value": "concede_contrast",
      "label": "Concede · Contrast",
      "rule": "The speaker needs to accept one point the other person makes and then offer a different view."
    },
    "targetSetting": {
      "value": "casual_chat",
      "label": "Casual chat",
      "description": "Chatting with friends or family, or sending private messages."
    },
    "transferType": "far",
    "previousSituations": [
      "同事说：“这个方案成本低，所以我们现在就做吧？”",
      "同事说：“这个方案成本低，我觉得可以先试一下。”你觉得成本确实不高，但担心它的效果还没有验证。"
    ]
  },
  "expect": {
    "mustNotContain": [
      "话虽如此"
    ],
    "maxCharacters": {
      "situationZh": 120,
      "interlocutor": 10
    },
    "maxWords": {
      "situationEn": 60,
      "taskEn": 30
    },
    "manualReview": [
      "Judge intention, expression sense, setting and Chinese naturalness.",
      "A later case also receives successful generated situations from earlier cases for this expression.",
      "Faithful English translation; neither the situation nor task reveals or translates answer wording."
    ]
  }
}
```

All attempts:

```json
{
  "number": 1,
  "status": "valid",
  "output": {
    "situationZh": "朋友说：“这家餐厅的菜又便宜又好吃，我们这周末就去吧！”你觉得价格确实很划算，但担心周末人太多，要排很久的队。",
    "situationEn": "Your friend says: \"This restaurant's food is cheap and delicious, let's go this weekend!\" You agree the price is very good, but you worry that on weekends there will be so many people that you have to wait in line for a long time.",
    "interlocutor": "朋友",
    "taskEn": "Reply to your friend, agreeing with the point about the price and then giving your different concern about the weekend crowds."
  },
  "comparison": {
    "checks": [
      {
        "label": "valid four-field scenario",
        "passed": true
      },
      {
        "label": "no extra model-owned fields",
        "passed": true
      },
      {
        "label": "target-free and previously unused scenario",
        "passed": true
      },
      {
        "label": "situationZh excludes 话虽如此",
        "passed": true
      },
      {
        "label": "situationEn excludes 话虽如此",
        "passed": true
      },
      {
        "label": "interlocutor excludes 话虽如此",
        "passed": true
      },
      {
        "label": "taskEn excludes 话虽如此",
        "passed": true
      }
    ],
    "manualReview": [
      "Judge intention, expression sense, setting and Chinese naturalness.",
      "A later case also receives successful generated situations from earlier cases for this expression.",
      "Faithful English translation; neither the situation nor task reveals or translates answer wording.",
      "A human must assess naturalness, intended meaning, reusable boundaries and genuinely different situations; passing these checks is not semantic acceptance."
    ]
  }
}
```

Selected result: first structurally valid attempt.

Human intention/setting/naturalness: pending.

## review-09

Input and expectations:

```json
{
  "input": {
    "task": "review_situation",
    "card": {
      "expression": "话虽如此",
      "meaningHere": "Even so, accepting a point before offering a different view.",
      "useItWhen": "When you acknowledge a reasonable point and then contrast it with another concern.",
      "toneAndWho": "Measured disagreement with colleagues and classmates."
    },
    "targetFunction": {
      "value": "concede_contrast",
      "label": "Concede · Contrast",
      "rule": "The speaker needs to accept one point the other person makes and then offer a different view."
    },
    "targetSetting": {
      "value": "work_school",
      "label": "Work & school",
      "description": "Talking with colleagues, managers, teachers or classmates, including meetings and class."
    },
    "transferType": "near",
    "previousSituations": [
      "同事说：“这个方案成本低，所以我们现在就做吧？”",
      "同事说：“这个方案成本低，我觉得可以先试一下。”你觉得成本确实不高，但担心它的效果还没有验证。",
      "朋友说：“这家餐厅的菜又便宜又好吃，我们这周末就去吧！”你觉得价格确实很划算，但担心周末人太多，要排很久的队。"
    ]
  },
  "expect": {
    "mustNotContain": [
      "话虽如此"
    ],
    "maxCharacters": {
      "situationZh": 120,
      "interlocutor": 10
    },
    "maxWords": {
      "situationEn": 60,
      "taskEn": 30
    },
    "manualReview": [
      "Judge intention, expression sense, setting and Chinese naturalness.",
      "A later case also receives successful generated situations from earlier cases for this expression.",
      "Faithful English translation; neither the situation nor task reveals or translates answer wording."
    ]
  }
}
```

All attempts:

```json
{
  "number": 1,
  "status": "valid",
  "output": {
    "situationZh": "组会上，同事说：“这个新工具能把数据处理时间缩短一半，我们下周就全面换掉旧系统吧？”",
    "situationEn": "At a team meeting, a colleague says: \"This new tool can cut data processing time in half, so let's fully replace the old system next week?\"",
    "interlocutor": "同事",
    "taskEn": "Reply by accepting that the time savings are real, then give a different view about whether a full switch next week is wise."
  },
  "comparison": {
    "checks": [
      {
        "label": "valid four-field scenario",
        "passed": true
      },
      {
        "label": "no extra model-owned fields",
        "passed": true
      },
      {
        "label": "target-free and previously unused scenario",
        "passed": true
      },
      {
        "label": "situationZh excludes 话虽如此",
        "passed": true
      },
      {
        "label": "situationEn excludes 话虽如此",
        "passed": true
      },
      {
        "label": "interlocutor excludes 话虽如此",
        "passed": true
      },
      {
        "label": "taskEn excludes 话虽如此",
        "passed": true
      }
    ],
    "manualReview": [
      "Judge intention, expression sense, setting and Chinese naturalness.",
      "A later case also receives successful generated situations from earlier cases for this expression.",
      "Faithful English translation; neither the situation nor task reveals or translates answer wording.",
      "A human must assess naturalness, intended meaning, reusable boundaries and genuinely different situations; passing these checks is not semantic acceptance."
    ]
  }
}
```

Selected result: first structurally valid attempt.

Human intention/setting/naturalness: pending.

## review-10

Input and expectations:

```json
{
  "input": {
    "task": "review_situation",
    "card": {
      "expression": "太夸张了",
      "meaningHere": "Something is far beyond the usual amount.",
      "useItWhen": "Stress an unusually extreme degree.",
      "toneAndWho": "Informal emphasis in group messages."
    },
    "targetFunction": {
      "value": "emphasize",
      "label": "Emphasize",
      "rule": "Something is clearly beyond the usual degree and needs to be stressed."
    },
    "targetSetting": {
      "value": "online_social",
      "label": "Online posts",
      "description": "Writing posts, comments, group-chat messages or bullet comments."
    },
    "transferType": "far",
    "previousSituations": [
      "在一次练习中，对方问你昨天那次活动怎么样。"
    ]
  },
  "expect": {
    "mustNotContain": [
      "太夸张了"
    ],
    "maxCharacters": {
      "situationZh": 120,
      "interlocutor": 10
    },
    "maxWords": {
      "situationEn": 60,
      "taskEn": 30
    },
    "manualReview": [
      "Judge the exact card meaning, required communicative act, setting and natural Chinese.",
      "Faithful English translation; neither the situation nor task reveals or translates answer wording."
    ]
  }
}
```

All attempts:

```json
{
  "number": 1,
  "status": "valid",
  "output": {
    "situationZh": "你朋友在群里发了一张照片，说他昨晚点的外卖送到时已经凉了，还多收了好几十块钱。大家都在看，他问你：你觉得这家店的服务怎么样？",
    "situationEn": "A friend posted a photo in the group chat saying the takeout he ordered last night arrived cold, and they charged him dozens of extra yuan. Everyone is looking at it, and he asks you what you think of this shop's service.",
    "interlocutor": "群里的朋友",
    "taskEn": "Reply in the group chat with a short comment giving your opinion of the shop's service, stressing how extreme it is."
  },
  "comparison": {
    "checks": [
      {
        "label": "valid four-field scenario",
        "passed": true
      },
      {
        "label": "no extra model-owned fields",
        "passed": true
      },
      {
        "label": "target-free and previously unused scenario",
        "passed": true
      },
      {
        "label": "situationZh excludes 太夸张了",
        "passed": true
      },
      {
        "label": "situationEn excludes 太夸张了",
        "passed": true
      },
      {
        "label": "interlocutor excludes 太夸张了",
        "passed": true
      },
      {
        "label": "taskEn excludes 太夸张了",
        "passed": true
      }
    ],
    "manualReview": [
      "Judge the exact card meaning, required communicative act, setting and natural Chinese.",
      "Faithful English translation; neither the situation nor task reveals or translates answer wording.",
      "A human must assess naturalness, intended meaning, reusable boundaries and genuinely different situations; passing these checks is not semantic acceptance."
    ]
  }
}
```

Selected result: first structurally valid attempt.

Human intention/setting/naturalness: pending.

## review-11

Input and expectations:

```json
{
  "input": {
    "task": "review_situation",
    "card": {
      "expression": "真没想到",
      "meaningHere": "The speaker is unexpectedly surprised.",
      "useItWhen": "React immediately to surprising news.",
      "toneAndWho": "Polite surprise with service staff."
    },
    "targetFunction": {
      "value": "react",
      "label": "React",
      "rule": "Something surprising, unexpected or shocking has just happened and needs an immediate reaction."
    },
    "targetSetting": {
      "value": "daily_errands",
      "label": "Daily errands",
      "description": "Talking with shop staff or service workers while shopping, eating out, taking a taxi or running errands."
    },
    "transferType": "near",
    "previousSituations": [
      "在一次练习中，对方问你昨天那次活动怎么样。"
    ]
  },
  "expect": {
    "mustNotContain": [
      "真没想到"
    ],
    "maxCharacters": {
      "situationZh": 120,
      "interlocutor": 10
    },
    "maxWords": {
      "situationEn": 60,
      "taskEn": 30
    },
    "manualReview": [
      "Judge the exact card meaning, required communicative act, setting and natural Chinese.",
      "Faithful English translation; neither the situation nor task reveals or translates answer wording."
    ]
  }
}
```

All attempts:

```json
{
  "number": 1,
  "status": "valid",
  "output": {
    "situationZh": "你在超市收银台结账，收银员说：\"您的会员卡里有一笔一百元的积分，已经帮您抵扣了。\"",
    "situationEn": "You are checking out at a supermarket cashier. The cashier says: \"Your membership card had 100 yuan in points, and we've already applied them to your bill.\"",
    "interlocutor": "收银员",
    "taskEn": "Reply to the cashier with an immediate, polite reaction to this unexpected news."
  },
  "comparison": {
    "checks": [
      {
        "label": "valid four-field scenario",
        "passed": true
      },
      {
        "label": "no extra model-owned fields",
        "passed": true
      },
      {
        "label": "target-free and previously unused scenario",
        "passed": true
      },
      {
        "label": "situationZh excludes 真没想到",
        "passed": true
      },
      {
        "label": "situationEn excludes 真没想到",
        "passed": true
      },
      {
        "label": "interlocutor excludes 真没想到",
        "passed": true
      },
      {
        "label": "taskEn excludes 真没想到",
        "passed": true
      }
    ],
    "manualReview": [
      "Judge the exact card meaning, required communicative act, setting and natural Chinese.",
      "Faithful English translation; neither the situation nor task reveals or translates answer wording.",
      "A human must assess naturalness, intended meaning, reusable boundaries and genuinely different situations; passing these checks is not semantic acceptance."
    ]
  }
}
```

Selected result: first structurally valid attempt.

Human intention/setting/naturalness: pending.

## review-12

Input and expectations:

```json
{
  "input": {
    "task": "review_situation",
    "card": {
      "expression": "不妨",
      "meaningHere": "A measured proposal to try something.",
      "useItWhen": "Offer advice without pressuring the reader.",
      "toneAndWho": "Suitable for formal written proposals."
    },
    "targetFunction": {
      "value": "suggest",
      "label": "Suggest",
      "rule": "The other person needs advice or needs to be persuaded."
    },
    "targetSetting": {
      "value": "formal_writing",
      "label": "Formal writing & speeches",
      "description": "Writing formal emails, reports or notices, or giving a speech."
    },
    "transferType": "far",
    "previousSituations": [
      "在一次练习中，对方问你昨天那次活动怎么样。"
    ]
  },
  "expect": {
    "mustNotContain": [
      "不妨"
    ],
    "maxCharacters": {
      "situationZh": 120,
      "interlocutor": 10
    },
    "maxWords": {
      "situationEn": 60,
      "taskEn": 30
    },
    "manualReview": [
      "Judge the exact card meaning, required communicative act, setting and natural Chinese.",
      "Faithful English translation; neither the situation nor task reveals or translates answer wording."
    ]
  }
}
```

All attempts:

```json
{
  "number": 1,
  "status": "valid",
  "output": {
    "situationZh": "你是公司项目组的负责人。下周要向部门提交一份正式报告，但你还没有决定是否把截止时间延后一周。同事王经理在邮件里问你：这件事你打算怎么处理？",
    "situationEn": "You are the head of a company project team. Next week you must submit a formal report to the department, but you have not yet decided whether to postpone the deadline by one week. Manager Wang asks you in an email what you plan to do about it.",
    "interlocutor": "王经理",
    "taskEn": "Write one sentence of a formal reply email to Manager Wang, suggesting a gentle course of action rather than insisting on it."
  },
  "comparison": {
    "checks": [
      {
        "label": "valid four-field scenario",
        "passed": true
      },
      {
        "label": "no extra model-owned fields",
        "passed": true
      },
      {
        "label": "target-free and previously unused scenario",
        "passed": true
      },
      {
        "label": "situationZh excludes 不妨",
        "passed": true
      },
      {
        "label": "situationEn excludes 不妨",
        "passed": true
      },
      {
        "label": "interlocutor excludes 不妨",
        "passed": true
      },
      {
        "label": "taskEn excludes 不妨",
        "passed": true
      }
    ],
    "manualReview": [
      "Judge the exact card meaning, required communicative act, setting and natural Chinese.",
      "Faithful English translation; neither the situation nor task reveals or translates answer wording.",
      "A human must assess naturalness, intended meaning, reusable boundaries and genuinely different situations; passing these checks is not semantic acceptance."
    ]
  }
}
```

Selected result: first structurally valid attempt.

Human intention/setting/naturalness: pending.

## review-13

Input and expectations:

```json
{
  "input": {
    "task": "review_situation",
    "card": {
      "expression": "除此之外",
      "meaningHere": "Add another relevant point.",
      "useItWhen": "Continue a short report with an additional point.",
      "toneAndWho": "Neutral to formal written transitions."
    },
    "targetFunction": {
      "value": "connect_ideas",
      "label": "Connect ideas",
      "rule": "A short account needs a transition, a contrast or a follow-on point."
    },
    "targetSetting": {
      "value": "formal_writing",
      "label": "Formal writing & speeches",
      "description": "Writing formal emails, reports or notices, or giving a speech."
    },
    "transferType": "near",
    "previousSituations": [
      "在一次练习中，对方问你昨天那次活动怎么样。"
    ]
  },
  "expect": {
    "mustNotContain": [
      "除此之外"
    ],
    "maxCharacters": {
      "situationZh": 120,
      "interlocutor": 10
    },
    "maxWords": {
      "situationEn": 60,
      "taskEn": 30
    },
    "manualReview": [
      "Judge the exact card meaning, required communicative act, setting and natural Chinese.",
      "Faithful English translation; neither the situation nor task reveals or translates answer wording."
    ]
  }
}
```

All attempts:

```json
{
  "number": 1,
  "status": "valid",
  "output": {
    "situationZh": "你负责写一份项目进展报告。同事问你：这份报告里已经写了哪些内容？你需要在报告中补充一个新的相关要点。",
    "situationEn": "You are writing a project progress report. A colleague asks you what content the report already includes. You need to add one more relevant point to the report.",
    "interlocutor": "同事",
    "taskEn": "Write one sentence of the report that adds another relevant point to what has already been stated."
  },
  "comparison": {
    "checks": [
      {
        "label": "valid four-field scenario",
        "passed": true
      },
      {
        "label": "no extra model-owned fields",
        "passed": true
      },
      {
        "label": "target-free and previously unused scenario",
        "passed": true
      },
      {
        "label": "situationZh excludes 除此之外",
        "passed": true
      },
      {
        "label": "situationEn excludes 除此之外",
        "passed": true
      },
      {
        "label": "interlocutor excludes 除此之外",
        "passed": true
      },
      {
        "label": "taskEn excludes 除此之外",
        "passed": true
      }
    ],
    "manualReview": [
      "Judge the exact card meaning, required communicative act, setting and natural Chinese.",
      "Faithful English translation; neither the situation nor task reveals or translates answer wording.",
      "A human must assess naturalness, intended meaning, reusable boundaries and genuinely different situations; passing these checks is not semantic acceptance."
    ]
  }
}
```

Selected result: first structurally valid attempt.

Human intention/setting/naturalness: pending.

## review-14

Input and expectations:

```json
{
  "input": {
    "task": "review_situation",
    "card": {
      "expression": "井井有条",
      "meaningHere": "Things are well organized.",
      "useItWhen": "Describe an organized arrangement or process.",
      "toneAndWho": "Neutral description with coworkers."
    },
    "targetFunction": {
      "value": "describe",
      "label": "Describe",
      "rule": "A person, thing or event needs to be described."
    },
    "targetSetting": {
      "value": "work_school",
      "label": "Work & school",
      "description": "Talking with colleagues, managers, teachers or classmates, including meetings and class."
    },
    "transferType": "near",
    "previousSituations": [
      "在一次练习中，对方问你昨天那次活动怎么样。"
    ]
  },
  "expect": {
    "mustNotContain": [
      "井井有条"
    ],
    "maxCharacters": {
      "situationZh": 120,
      "interlocutor": 10
    },
    "maxWords": {
      "situationEn": 60,
      "taskEn": 30
    },
    "manualReview": [
      "Judge the exact card meaning, required communicative act, setting and natural Chinese.",
      "Faithful English translation; neither the situation nor task reveals or translates answer wording."
    ]
  }
}
```

All attempts:

```json
{
  "number": 1,
  "status": "valid",
  "output": {
    "situationZh": "经理问你，上周的项目资料你是怎么整理的？他说大家都觉得你的文件夹特别清楚。",
    "situationEn": "Your manager asks how you organized last week's project materials. He says everyone thinks your folders are very clear.",
    "interlocutor": "经理",
    "taskEn": "Reply to your manager and describe how your project materials are arranged, without naming the expression."
  },
  "comparison": {
    "checks": [
      {
        "label": "valid four-field scenario",
        "passed": true
      },
      {
        "label": "no extra model-owned fields",
        "passed": true
      },
      {
        "label": "target-free and previously unused scenario",
        "passed": true
      },
      {
        "label": "situationZh excludes 井井有条",
        "passed": true
      },
      {
        "label": "situationEn excludes 井井有条",
        "passed": true
      },
      {
        "label": "interlocutor excludes 井井有条",
        "passed": true
      },
      {
        "label": "taskEn excludes 井井有条",
        "passed": true
      }
    ],
    "manualReview": [
      "Judge the exact card meaning, required communicative act, setting and natural Chinese.",
      "Faithful English translation; neither the situation nor task reveals or translates answer wording.",
      "A human must assess naturalness, intended meaning, reusable boundaries and genuinely different situations; passing these checks is not semantic acceptance."
    ]
  }
}
```

Selected result: first structurally valid attempt.

Human intention/setting/naturalness: pending.

## review-15

Input and expectations:

```json
{
  "input": {
    "task": "review_situation",
    "card": {
      "expression": "久违了",
      "meaningHere": "Warm recognition after a long absence.",
      "useItWhen": "Greet someone or welcome something absent for a long time.",
      "toneAndWho": "Warm and natural with familiar people."
    },
    "targetFunction": {
      "value": "other",
      "label": "Other",
      "rule": "Use useItWhen to decide what the situation must require."
    },
    "targetSetting": {
      "value": "casual_chat",
      "label": "Casual chat",
      "description": "Chatting with friends or family, or sending private messages."
    },
    "transferType": "far",
    "previousSituations": [
      "在一次练习中，对方问你昨天那次活动怎么样。"
    ]
  },
  "expect": {
    "mustNotContain": [
      "久违了"
    ],
    "maxCharacters": {
      "situationZh": 120,
      "interlocutor": 10
    },
    "maxWords": {
      "situationEn": 60,
      "taskEn": 30
    },
    "manualReview": [
      "Judge the exact card meaning, required communicative act, setting and natural Chinese.",
      "Faithful English translation; neither the situation nor task reveals or translates answer wording."
    ]
  }
}
```

All attempts:

```json
{
  "number": 1,
  "status": "valid",
  "output": {
    "situationZh": "你在超市门口碰到一个很久没见的老同学，他正提着一袋水果。他看到你，眼睛一亮，朝你走过来。",
    "situationEn": "You run into an old classmate you haven't seen in years at the supermarket entrance. He is carrying a bag of fruit, and when he sees you his eyes light up and he walks toward you.",
    "interlocutor": "老同学",
    "taskEn": "Reply to your old classmate in a casual, warm way, as if greeting someone you haven't seen for a long time."
  },
  "comparison": {
    "checks": [
      {
        "label": "valid four-field scenario",
        "passed": true
      },
      {
        "label": "no extra model-owned fields",
        "passed": true
      },
      {
        "label": "target-free and previously unused scenario",
        "passed": true
      },
      {
        "label": "situationZh excludes 久违了",
        "passed": true
      },
      {
        "label": "situationEn excludes 久违了",
        "passed": true
      },
      {
        "label": "interlocutor excludes 久违了",
        "passed": true
      },
      {
        "label": "taskEn excludes 久违了",
        "passed": true
      }
    ],
    "manualReview": [
      "Judge the exact card meaning, required communicative act, setting and natural Chinese.",
      "Faithful English translation; neither the situation nor task reveals or translates answer wording.",
      "A human must assess naturalness, intended meaning, reusable boundaries and genuinely different situations; passing these checks is not semantic acceptance."
    ]
  }
}
```

Selected result: first structurally valid attempt.

Human intention/setting/naturalness: pending.

## review-16

Input and expectations:

```json
{
  "input": {
    "task": "review_situation",
    "card": {
      "expression": "有两把刷子",
      "meaningHere": "To have real skill or ability.",
      "useItWhen": "When someone has done something well and deserves recognition.",
      "toneAndWho": "Casual praise between friends."
    },
    "targetFunction": {
      "value": "praise",
      "label": "Praise",
      "rule": "Someone or something deserves praise or approval."
    },
    "targetSetting": {
      "value": "casual_chat",
      "label": "Casual chat",
      "description": "Chatting with friends or family, or sending private messages."
    },
    "transferType": "near",
    "previousSituations": [
      "在一次练习中，对方问你昨天那次活动怎么样。"
    ]
  },
  "expect": {
    "mustNotContain": [
      "有两把刷子"
    ],
    "maxCharacters": {
      "situationZh": 120,
      "interlocutor": 10
    },
    "maxWords": {
      "situationEn": 60,
      "taskEn": 30
    },
    "manualReview": [
      "Judge the exact card meaning, required communicative act, setting and natural Chinese.",
      "Faithful English translation; neither the situation nor task reveals or translates answer wording."
    ]
  }
}
```

All attempts:

```json
{
  "number": 1,
  "status": "valid",
  "output": {
    "situationZh": "朋友小王刚打完一场篮球比赛，三分球投进了好几个。他兴奋地跑过来问你：“你刚才看到我的投篮了吗？”",
    "situationEn": "Your friend Xiao Wang just finished a basketball game in which he made several three-pointers. Excited, he runs over and asks you: \"Did you see my shots just now?\"",
    "interlocutor": "朋友小王",
    "taskEn": "Reply casually to your friend, giving your honest reaction to his shooting and showing that you think he played really well."
  },
  "comparison": {
    "checks": [
      {
        "label": "valid four-field scenario",
        "passed": true
      },
      {
        "label": "no extra model-owned fields",
        "passed": true
      },
      {
        "label": "target-free and previously unused scenario",
        "passed": true
      },
      {
        "label": "situationZh excludes 有两把刷子",
        "passed": true
      },
      {
        "label": "situationEn excludes 有两把刷子",
        "passed": true
      },
      {
        "label": "interlocutor excludes 有两把刷子",
        "passed": true
      },
      {
        "label": "taskEn excludes 有两把刷子",
        "passed": true
      }
    ],
    "manualReview": [
      "Judge the exact card meaning, required communicative act, setting and natural Chinese.",
      "Faithful English translation; neither the situation nor task reveals or translates answer wording.",
      "A human must assess naturalness, intended meaning, reusable boundaries and genuinely different situations; passing these checks is not semantic acceptance."
    ]
  }
}
```

Selected result: first structurally valid attempt.

Human intention/setting/naturalness: pending.

## review-17

Input and expectations:

```json
{
  "input": {
    "task": "review_situation",
    "card": {
      "expression": "划不来",
      "meaningHere": "The exchange is not worth its cost.",
      "useItWhen": "Express dissatisfaction about poor value.",
      "toneAndWho": "Conversational, with service staff or companions."
    },
    "targetFunction": {
      "value": "complain",
      "label": "Complain",
      "rule": "Something annoying, unfair or costly has happened and the speaker needs to express dissatisfaction."
    },
    "targetSetting": {
      "value": "daily_errands",
      "label": "Daily errands",
      "description": "Talking with shop staff or service workers while shopping, eating out, taking a taxi or running errands."
    },
    "transferType": "far",
    "previousSituations": [
      "在一次练习中，对方问你昨天那次活动怎么样。"
    ]
  },
  "expect": {
    "mustNotContain": [
      "划不来"
    ],
    "maxCharacters": {
      "situationZh": 120,
      "interlocutor": 10
    },
    "maxWords": {
      "situationEn": 60,
      "taskEn": 30
    },
    "manualReview": [
      "Judge the exact card meaning, required communicative act, setting and natural Chinese.",
      "Faithful English translation; neither the situation nor task reveals or translates answer wording."
    ]
  }
}
```

All attempts:

```json
{
  "number": 1,
  "status": "valid",
  "output": {
    "situationZh": "你在超市买了一个西瓜，回家一切开，发现里面是坏的。你拿着它回到收银台，服务员问你有什么事。",
    "situationEn": "You bought a watermelon at the supermarket. When you cut it open at home, you found it was spoiled. You bring it back to the checkout, and the staff member asks what the problem is.",
    "interlocutor": "超市收银员",
    "taskEn": "Reply to the cashier and explain why you are unhappy with the watermelon you bought, in a conversational tone."
  },
  "comparison": {
    "checks": [
      {
        "label": "valid four-field scenario",
        "passed": true
      },
      {
        "label": "no extra model-owned fields",
        "passed": true
      },
      {
        "label": "target-free and previously unused scenario",
        "passed": true
      },
      {
        "label": "situationZh excludes 划不来",
        "passed": true
      },
      {
        "label": "situationEn excludes 划不来",
        "passed": true
      },
      {
        "label": "interlocutor excludes 划不来",
        "passed": true
      },
      {
        "label": "taskEn excludes 划不来",
        "passed": true
      }
    ],
    "manualReview": [
      "Judge the exact card meaning, required communicative act, setting and natural Chinese.",
      "Faithful English translation; neither the situation nor task reveals or translates answer wording.",
      "A human must assess naturalness, intended meaning, reusable boundaries and genuinely different situations; passing these checks is not semantic acceptance."
    ]
  }
}
```

Selected result: first structurally valid attempt.

Human intention/setting/naturalness: pending.

## review-18

Input and expectations:

```json
{
  "input": {
    "task": "review_situation",
    "card": {
      "expression": "归根结底",
      "meaningHere": "Identify the ultimate underlying reason.",
      "useItWhen": "Summarize the root reason after discussing details.",
      "toneAndWho": "Measured summary in reports and speeches."
    },
    "targetFunction": {
      "value": "explain_sum_up",
      "label": "Explain · Sum up",
      "rule": "The other person has not understood, or a discussion needs to be summed up."
    },
    "targetSetting": {
      "value": "formal_writing",
      "label": "Formal writing & speeches",
      "description": "Writing formal emails, reports or notices, or giving a speech."
    },
    "transferType": "far",
    "previousSituations": [
      "在一次练习中，对方问你昨天那次活动怎么样。"
    ]
  },
  "expect": {
    "mustNotContain": [
      "归根结底"
    ],
    "maxCharacters": {
      "situationZh": 120,
      "interlocutor": 10
    },
    "maxWords": {
      "situationEn": 60,
      "taskEn": 30
    },
    "manualReview": [
      "Judge the exact card meaning, required communicative act, setting and natural Chinese.",
      "Faithful English translation; neither the situation nor task reveals or translates answer wording."
    ]
  }
}
```

All attempts:

```json
{
  "number": 1,
  "status": "valid",
  "output": {
    "situationZh": "你是公司项目组的负责人。上个月项目延期了三周，部门领导要求你在正式报告中写一句总结，说明延期的根本原因。",
    "situationEn": "You are the head of a company project team. The project was delayed by three weeks last month, and the department director asks you to write one summarizing sentence in the formal report explaining the root cause of the delay.",
    "interlocutor": "部门领导",
    "taskEn": "Write one formal sentence for the report that states the ultimate underlying reason for the delay, after the details have been discussed."
  },
  "comparison": {
    "checks": [
      {
        "label": "valid four-field scenario",
        "passed": true
      },
      {
        "label": "no extra model-owned fields",
        "passed": true
      },
      {
        "label": "target-free and previously unused scenario",
        "passed": true
      },
      {
        "label": "situationZh excludes 归根结底",
        "passed": true
      },
      {
        "label": "situationEn excludes 归根结底",
        "passed": true
      },
      {
        "label": "interlocutor excludes 归根结底",
        "passed": true
      },
      {
        "label": "taskEn excludes 归根结底",
        "passed": true
      }
    ],
    "manualReview": [
      "Judge the exact card meaning, required communicative act, setting and natural Chinese.",
      "Faithful English translation; neither the situation nor task reveals or translates answer wording.",
      "A human must assess naturalness, intended meaning, reusable boundaries and genuinely different situations; passing these checks is not semantic acceptance."
    ]
  }
}
```

Selected result: first structurally valid attempt.

Human intention/setting/naturalness: pending.

## review-19

Input and expectations:

```json
{
  "input": {
    "task": "review_situation",
    "card": {
      "expression": "退一步说",
      "meaningHere": "Temporarily accept a premise to consider another point.",
      "useItWhen": "Concede one assumption and put forward a different consideration.",
      "toneAndWho": "Measured discussion with colleagues."
    },
    "targetFunction": {
      "value": "concede_contrast",
      "label": "Concede · Contrast",
      "rule": "The speaker needs to accept one point the other person makes and then offer a different view."
    },
    "targetSetting": {
      "value": "work_school",
      "label": "Work & school",
      "description": "Talking with colleagues, managers, teachers or classmates, including meetings and class."
    },
    "transferType": "far",
    "previousSituations": [
      "在一次练习中，对方问你昨天那次活动怎么样。"
    ]
  },
  "expect": {
    "mustNotContain": [
      "退一步说"
    ],
    "maxCharacters": {
      "situationZh": 120,
      "interlocutor": 10
    },
    "maxWords": {
      "situationEn": 60,
      "taskEn": 30
    },
    "manualReview": [
      "Judge the exact card meaning, required communicative act, setting and natural Chinese.",
      "Faithful English translation; neither the situation nor task reveals or translates answer wording."
    ]
  }
}
```

All attempts:

```json
{
  "number": 1,
  "status": "valid",
  "output": {
    "situationZh": "项目会议上，同事说这个方案成本太高，不如直接放弃。你觉得他说得有道理，但想从用户体验的角度再考虑一下。他看着你，等你回应。",
    "situationEn": "In a project meeting, a colleague says this plan costs too much and should just be dropped. You think he has a point, but you want to consider it from the user experience angle. He looks at you, waiting for your reply.",
    "interlocutor": "同事",
    "taskEn": "Reply to your colleague, accepting his cost point and then raising a different consideration about user experience."
  },
  "comparison": {
    "checks": [
      {
        "label": "valid four-field scenario",
        "passed": true
      },
      {
        "label": "no extra model-owned fields",
        "passed": true
      },
      {
        "label": "target-free and previously unused scenario",
        "passed": true
      },
      {
        "label": "situationZh excludes 退一步说",
        "passed": true
      },
      {
        "label": "situationEn excludes 退一步说",
        "passed": true
      },
      {
        "label": "interlocutor excludes 退一步说",
        "passed": true
      },
      {
        "label": "taskEn excludes 退一步说",
        "passed": true
      }
    ],
    "manualReview": [
      "Judge the exact card meaning, required communicative act, setting and natural Chinese.",
      "Faithful English translation; neither the situation nor task reveals or translates answer wording.",
      "A human must assess naturalness, intended meaning, reusable boundaries and genuinely different situations; passing these checks is not semantic acceptance."
    ]
  }
}
```

Selected result: first structurally valid attempt.

Human intention/setting/naturalness: pending.

## review-20

Input and expectations:

```json
{
  "input": {
    "task": "review_situation",
    "card": {
      "expression": "活灵活现",
      "meaningHere": "A portrayal feels vivid and lifelike.",
      "useItWhen": "Describe a vivid performance or portrayal.",
      "toneAndWho": "Positive description in comments or group posts."
    },
    "targetFunction": {
      "value": "describe",
      "label": "Describe",
      "rule": "A person, thing or event needs to be described."
    },
    "targetSetting": {
      "value": "online_social",
      "label": "Online posts",
      "description": "Writing posts, comments, group-chat messages or bullet comments."
    },
    "transferType": "far",
    "previousSituations": [
      "在一次练习中，对方问你昨天那次活动怎么样。"
    ]
  },
  "expect": {
    "mustNotContain": [
      "活灵活现"
    ],
    "maxCharacters": {
      "situationZh": 120,
      "interlocutor": 10
    },
    "maxWords": {
      "situationEn": 60,
      "taskEn": 30
    },
    "manualReview": [
      "Judge the exact card meaning, required communicative act, setting and natural Chinese.",
      "Faithful English translation; neither the situation nor task reveals or translates answer wording."
    ]
  }
}
```

All attempts:

```json
{
  "number": 1,
  "status": "valid",
  "output": {
    "situationZh": "我的朋友在群里说，她昨晚看了一部话剧，主演把一个老人的性格演得特别逼真。她问你：你看过这个版本吗？你觉得演员的表演怎么样？",
    "situationEn": "A friend says in the group chat that she watched a stage play last night, and the lead actor played an old man's personality so convincingly. She asks you whether you've seen this version and what you think of the actor's performance.",
    "interlocutor": "朋友（群聊）",
    "taskEn": "Reply in the group chat with a short comment describing how the actor's performance comes across to you."
  },
  "comparison": {
    "checks": [
      {
        "label": "valid four-field scenario",
        "passed": true
      },
      {
        "label": "no extra model-owned fields",
        "passed": true
      },
      {
        "label": "target-free and previously unused scenario",
        "passed": true
      },
      {
        "label": "situationZh excludes 活灵活现",
        "passed": true
      },
      {
        "label": "situationEn excludes 活灵活现",
        "passed": true
      },
      {
        "label": "interlocutor excludes 活灵活现",
        "passed": true
      },
      {
        "label": "taskEn excludes 活灵活现",
        "passed": true
      }
    ],
    "manualReview": [
      "Judge the exact card meaning, required communicative act, setting and natural Chinese.",
      "Faithful English translation; neither the situation nor task reveals or translates answer wording.",
      "A human must assess naturalness, intended meaning, reusable boundaries and genuinely different situations; passing these checks is not semantic acceptance."
    ]
  }
}
```

Selected result: first structurally valid attempt.

Human intention/setting/naturalness: pending.
