---
title: "组合是编程的本质"
tags: ["why-programs-compose"]
---
把大问题拆成小块、写完每块、再把它们拼回去，这是写程序时一直在做的事。本篇解释拆解为什么必要、什么样的块拼得起来，以及范畴论为什么把「箭头如何拼接」当作起点，不看对象内部。[范畴](../categories/category/) 给出拼接必须满足的两条规矩，本篇只回答我们为什么在意拼接。

## 拆开之后要能拼回

统计一段文本里所有单词的总长度。可以写成一个函数，从头扫到尾；也可以拆成三步：切出单词、量出每个词的长度、把长度加起来。

```rust
fn words(text: &str) -> Vec<&str> {
    text.split_whitespace().collect()
}

fn lengths(ws: Vec<&str>) -> Vec<usize> {
    ws.into_iter().map(str::len).collect()
}

fn total(ns: Vec<usize>) -> usize {
    ns.into_iter().sum()
}
```

调用时把三块串起来，写成 `total(lengths(words(text)))`。

> [!marginnote] 记号方向
> 数学记号把「先 f 后 g」写成 $g \circ f$，从右往左读；上面的嵌套调用是同一个方向，写在最里面的那一步先执行。

拆开本身不产生价值。价值出现在需要第二个答案的时候。把问题改成「最长的词有多长」，只需换掉最后一块：

```rust
fn longest(ns: Vec<usize>) -> usize {
    ns.into_iter().max().unwrap_or(0)
}
```

前两块一个字都不用改。完整程序：

```rust
fn words(text: &str) -> Vec<&str> {
    text.split_whitespace().collect()
}

fn lengths(ws: Vec<&str>) -> Vec<usize> {
    ws.into_iter().map(str::len).collect()
}

fn total(ns: Vec<usize>) -> usize {
    ns.into_iter().sum()
}

fn longest(ns: Vec<usize>) -> usize {
    ns.into_iter().max().unwrap_or(0)
}

fn main() {
    let text = "the essence of composition";

    // 同样的前两块，换掉最后一块，得到另一个解
    let total_len = total(lengths(words(text)));
    let max_len = longest(lengths(words(text)));

    assert_eq!(total_len, 23);
    assert_eq!(max_len, 11);

    // 空输入：每一块都要自己站得住
    assert_eq!(total(lengths(words(""))), 0);
    assert_eq!(longest(lengths(words(""))), 0);

    println!("total={} max={}", total_len, max_len);
}
```

运行输出 `total=23 max=11`，四组断言全部通过。

如果当初写成一个从头扫到尾的函数，现在有两条路：复制一份改几行，或者给它加一个参数和一个分支。两条路都会让下一次修改更难。分解的意义不在于块变小，而在于块能重新排列。

## 我们为什么必须拆

不是因为拆开好看。人一次能同时把握的概念数量有限，心理学里常引的估计是 $7 \pm 2$ 个信息块[^miller]。这个数字后来被反复修正，但上限存在这件事没有争议。

面对一团互相牵连的代码，我们没法同时盯住所有分支。说某段代码「优雅」，多数时候是在说它的块足够小，小到能一次装进脑子。CTFP 第一章把这层意思说得很直白：我们需要结构，不是因为结构化的程序好看，而是因为思维处理不了无结构的信息。

## 什么样的块拼得起来

CTFP 用了一个几何比喻：好的块，表面积增长得比体积慢。

体积是实现这一块所需要知道的一切，表面积是把它和别的块拼起来时需要知道的一切。几何里表面积按边长的平方增长，体积按立方增长，所以块越大，表面相对越小。写完一块之后就可以忘掉它的实现，只把签名留在视野里。

`lengths` 的体积是那一行迭代器调用——迭代器怎么消费、取长度的方法从哪里来、`collect` 需要什么条件。它的表面积只有一行：吃 `Vec<&str>`，吐 `Vec<usize>`。要把它和别的块拼起来，知道这一行就够了。

面向对象里，类或接口的声明是表面；函数式里，函数的签名是表面。

## 对象是星云

范畴论在这件事上走得更远：它不给你看对象内部。

范畴里的对象没有内部结构可言。关于一个对象，你能知道的只有连接它的那些箭头。CTFP 把对象比作星云——看不清里面，只能通过它与周围的关系认识它。

这不是故作神秘。搜索引擎给网页排名时，主要看的也是链入与链出的链接，而不是逐字读完网页内容。一个对象如果必须剖开才能理解它怎么和别的对象协作，那么把它包起来的意义就没有了。

后面几乎每个构造都遵守这条纪律：[泛构造](../universal-constructions/universal-construction/) 用箭头刻画「积」，不说积里面装了什么；[同构](../universal-constructions/isomorphism/) 用箭头判断两个对象是不是同一个。

## 签名相同，不一定能互换

类型签名是表面，但表面不止有类型。

下面两个函数的签名一字不差，都能插进同一条组合链：

```rust
fn lengths_bytes(ws: Vec<&str>) -> Vec<usize> {
    ws.into_iter().map(str::len).collect()
}

fn lengths_chars(ws: Vec<&str>) -> Vec<usize> {
    ws.into_iter().map(|w| w.chars().count()).collect()
}
```

对纯 ASCII 文本，两者给出同一个答案；换成中文就不同了：

```rust
fn words(text: &str) -> Vec<&str> {
    text.split_whitespace().collect()
}

fn total(ns: Vec<usize>) -> usize {
    ns.into_iter().sum()
}

fn lengths_bytes(ws: Vec<&str>) -> Vec<usize> {
    ws.into_iter().map(str::len).collect()
}

fn lengths_chars(ws: Vec<&str>) -> Vec<usize> {
    ws.into_iter().map(|w| w.chars().count()).collect()
}

fn main() {
    let ascii = "the essence of composition";
    assert_eq!(total(lengths_bytes(words(ascii))), 23);
    assert_eq!(total(lengths_chars(words(ascii))), 23);

    let cjk = "范畴 是 组合";
    assert_eq!(total(lengths_bytes(words(cjk))), 15);
    assert_eq!(total(lengths_chars(words(cjk))), 5);

    println!("ascii agrees; cjk: bytes=15 chars=5");
}
```

运行输出 `ascii agrees; cjk: bytes=15 chars=5`。取长度的方法数的是字节，`chars().count()` 数的是字符，六个汉字加两个空格是 15 个字节、5 个字符。

编译器不会拦你。两个函数在类型上可以互相替换，差别藏在文档、命名和你的记忆里。组合会把这类差别推远：链条越长，出错的那一环离发现问题的地方越远。

这不说明分解有问题，说明表面积不等于类型签名。把单位编码进类型可以让这个差别显形，题 2 给出做法。

## 练习

### 题 1

统计「平均词长」，尽量复用上面的块，说明哪一块必须新写。

解：`words` 与 `lengths` 原样使用，新写一块。平均值需要同时知道总和与个数，而 `total` 把个数丢掉了，所以没法在 `total` 之后接一块补救：

```rust
fn words(text: &str) -> Vec<&str> {
    text.split_whitespace().collect()
}

fn lengths(ws: Vec<&str>) -> Vec<usize> {
    ws.into_iter().map(str::len).collect()
}

fn average(ns: Vec<usize>) -> f64 {
    let n = ns.len();
    if n == 0 {
        return 0.0;
    }
    ns.into_iter().sum::<usize>() as f64 / n as f64
}

fn main() {
    assert_eq!(average(lengths(words("the essence of composition"))), 5.75);
    assert_eq!(average(lengths(words(""))), 0.0);
    println!("average=5.75");
}
```

空输入返回 `0.0`：每一块都要自己处理边界，否则组合链上任何一环都可能中断整条链。这一题也划出了分解的限度——块之间只传结果，不传中间信息，个数在 `total` 那一步丢掉之后就补不回来。

### 题 2

`lengths_bytes` 与 `lengths_chars` 的类型签名相同，编译器无法阻止误用。把这个差别搬到类型上。

解：给两种长度各起一个类型：

```rust
#[derive(Debug, PartialEq)]
struct Bytes(usize);
#[derive(Debug, PartialEq)]
struct Chars(usize);

fn words(text: &str) -> Vec<&str> {
    text.split_whitespace().collect()
}

fn lengths_bytes(ws: Vec<&str>) -> Vec<Bytes> {
    ws.into_iter().map(|w| Bytes(w.len())).collect()
}

fn lengths_chars(ws: Vec<&str>) -> Vec<Chars> {
    ws.into_iter().map(|w| Chars(w.chars().count())).collect()
}

fn total_bytes(ns: Vec<Bytes>) -> Bytes {
    Bytes(ns.into_iter().map(|b| b.0).sum())
}

fn main() {
    let cjk = "范畴 是 组合";
    assert_eq!(total_bytes(lengths_bytes(words(cjk))), Bytes(15));
    let _ = lengths_chars(words(cjk));
    println!("bytes=Bytes(15)");
}
```

把字符长度喂给 `total_bytes` 会被编译器拦下：

```text
error[E0308]: mismatched types
   |                 ----------- ^^^^^^^^^^^^^^^^^^^^^^^^^ expected `Vec<Bytes>`, found `Vec<Chars>`
```

代价是每种单位都要配一套函数。表面积变大了，换来的是误用从运行期移到编译期。

### 题 3

一段代码拆成三块之后，某次修改需要同时改动三块。这说明分解有问题吗？

解：要看改的是什么。如果三块都得改，是因为需求本身横跨三步（比如从「按词统计」改成「按行统计」），那是需求的形状，跟分解方式无关。如果是因为三块共享了一个没有写出来的约定（比如都假设输入已经去掉了首尾空白），那么这个约定就是漏掉的表面，应该显式化——写进类型、写成参数，或者把三块合并成一块。

判断依据是修改的原因，不是修改的块数。

## 相关词条

- [范畴](../categories/category/) — 拼接必须满足的两条公理
- [Rust 中的函数组合](../categories/composition-in-rust/) — 把嵌套调用写成组合函数，以及所有权带来的限制
- [恒等态射](../categories/identity-morphism/) — 组合里那个什么都不做的元素
- [类型即集合](../types-and-functions/types-as-sets/) — 本篇默认的「对象就是类型」是怎么回事
- [泛构造](../universal-constructions/universal-construction/) — 只用箭头刻画结构的做法

[^miller]: George A. Miller 1956 年的论文给出 $7 \pm 2$ 这个估计。后续研究把有效容量下修到 4 左右，具体数字有争议，容量有限这件事没有争议。CTFP 第一章引用了这篇论文。
