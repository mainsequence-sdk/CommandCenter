# Reference Variables

Reference variables let one widget setting use a live value from another widget. Use them when the
workspace should react to a user's selection, instead of asking the user to copy a symbol, id,
project name, or filter value by hand.

The most common example is a table controlling the rest of a workspace: the user clicks a row in a
table, a query uses the selected symbol, and the chart or downstream table refreshes.

## The Mental Model

A reference variable has three parts:

- The source widget: the widget that publishes the value, such as a table.
- The source output: the value published by that widget, such as `activeRow` or `activeCellValue`.
- The target setting: the field that should use the value, such as a query symbol, filter, title, or
  parameter.

The target setting stores a reference, not a pasted value. If the source value changes, the target
can resolve the new value and refresh whatever depends on it.

## Basic Syntax

Reference variables use this format:

```text
$(source-widget).sourceOutput
```

Use a dot path when the output is an object:

```text
$(source-widget).sourceOutput.fieldName
```

Use array access when the output contains a list:

```text
$(source-widget).sourceOutput.rows[0].Symbol
$(source-widget).sourceOutput.rows[last].Symbol
```

The `source-widget` can be the widget id or the widget title. Prefer the widget id when you know it,
because titles can be renamed.

## How To Insert One

1. Open the workspace.
2. Open the settings for the widget that should receive the value.
3. Click the setting field that should become dynamic.
4. Type `$(` to open the reference picker.
5. Pick the source widget.
6. After the widget token, type `.` and pick the output, such as `activeRow` or `activeCellValue`.
7. If the output is an object, type another `.` and pick the field, such as `Symbol`.
8. Save the workspace.
9. Go back to the canvas and operate the source widget, such as clicking a table row.

When the reference is complete, the field should show a readable token like
`Prices Table · Active row.Symbol`. That means Command Center understood the reference.

## Table Selection Outputs

Tables are the most common source for reference variables.

| Output | Use It When | Example |
| --- | --- | --- |
| `activeCellValue` | The clicked cell is exactly the value you need. | `$(prices-table).activeCellValue` |
| `activeRow` | The clicked row has multiple fields and you need one column. | `$(prices-table).activeRow.Symbol` |
| `activeCell` | You need the cell metadata, such as column key or row payload. | `$(prices-table).activeCell.value` |
| `selectedRows` | You need values from the selected row collection. | `$(prices-table).selectedRows.rows[0].Symbol` |

If the table has a column named `Symbol`, a row click can drive a query with:

```text
$(prices-table).activeRow.Symbol
```

If the table cell itself contains `ETHUSDT`, a cell click can drive the same query with:

```text
$(prices-table).activeCellValue
```

## Copyable Examples

Use the selected table row's `Symbol` field as a query symbol:

```text
$(prices-table).activeRow.Symbol
```

Use the selected table cell as the entire setting value:

```text
$(prices-table).activeCellValue
```

Use the selected table row's `portfolio_id` field as a filter:

```text
$(portfolio-table).activeRow.portfolio_id
```

Use the selected table row's `asset_id` field as an app or widget parameter:

```text
$(assets-table).activeRow.asset_id
```

Use the first selected row from a selected-row collection:

```text
$(prices-table).selectedRows.rows[0].Symbol
```

Use the last selected row from a selected-row collection:

```text
$(prices-table).selectedRows.rows[last].Symbol
```

Use the current title of another widget:

```text
$(source-widget).title
```

Read a saved setting from another widget:

```text
$(query-widget).props.query.symbols[0]
```

Read a runtime selection detail when a normal output is not enough:

```text
$(prices-table).runtimeState.interaction.selection.selectedRowKeys[last]
```

Prefer normal outputs such as `activeRow` and `activeCellValue` before using `props` or
`runtimeState`. `props` and `runtimeState` are useful for advanced cases, but they are easier to
break if the source widget changes shape.

## Common Workflows

### Click A Table Row To Refresh A Query

Use this when a workspace has a table of markets, customers, projects, or assets and the rest of the
workspace should follow the selected row.

Put this in the target query's symbol, id, or filter field:

```text
$(prices-table).activeRow.Symbol
```

Then click a row in `prices-table`. The target query should resolve the clicked row's `Symbol`
value, run again, and update downstream widgets that depend on that query.

### Click A Cell To Drive A Single-Value Setting

Use this when the table cell already contains exactly the value the target setting expects.

Put this in the target setting:

```text
$(prices-table).activeCellValue
```

Then click the cell containing the value. This is simpler than `activeRow` when the selected cell is
the whole input.

### Use A Reference In A List Field

Some query settings expect a list of values, not a single value. In that case, put the reference as
the list item.

Example list with one selected symbol:

```json
["$(prices-table).activeRow.Symbol"]
```

If the field is a visual list editor, add one item and use the reference as that item.

### Use A Reference As A Widget Title

Use this when the title should become the selected value, such as the selected symbol or selected
project.

Set the widget title to:

```text
$(prices-table).activeRow.Symbol
```

After the user clicks a different row, the title can resolve to that row's value.

## Reference Variables Or Bindings?

Use a reference variable when the target needs one value inside one setting.

Use a normal widget binding when the target needs a whole output, such as a dataset feeding a table,
chart, statistic, or transformation.

| Need | Use |
| --- | --- |
| A selected symbol drives a query field. | Reference variable |
| A selected portfolio id drives an app parameter. | Reference variable |
| A query result feeds a chart. | Widget binding |
| A table dataset feeds another table. | Widget binding |
| A widget title should show the selected row value. | Reference variable |

## What Should Happen After It Works

When the source value changes:

- The target setting resolves the new value.
- If the target widget can execute, it should refresh.
- Widgets downstream from that target should update from the new result.
- The workspace should not require manually editing the target widget again.

For example, changing the selected table row from `ETHUSDT` to `BTCUSDT` should make the query run
for `BTCUSDT` and update the chart or table connected to that query.

## Troubleshooting

- If typing `$(` does not show reference options, the field may not support reference variables.
- If the reference token does not appear, the expression is probably incomplete. A valid expression
  needs a widget and an output, such as `$(prices-table).activeRow`.
- If the value is blank, click or select a value in the source widget first.
- If `activeRow.Symbol` is blank, confirm the table column is actually named `Symbol`. Field names
  must match the output data.
- If the target expects a list, use the reference as a list item, such as
  `["$(prices-table).activeRow.Symbol"]`.
- If the target does not refresh, open the workspace graph and confirm the source widget is connected
  to the target setting.
- If a query runs but returns the wrong data, confirm the resolved value is valid for that query.
