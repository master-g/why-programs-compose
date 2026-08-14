---
title: "集合与函数：定义域、陪域与组合"
tags: ["why-programs-compose"]
---
集合是一堆互不相同的元素，函数是从一个集合到另一个集合的指派。本篇列齐读本库需要的记号：属于与子集、定义域(domain)与陪域(codomain)、像(image)、组合 $g \circ f$、恒等函数，以及单射、满射、双射这三个词。定位是速查，不求把集合论讲完；[范畴](../categories/category/) 用这些记号写下两条公理，[类型即集合](../types-and-functions/types-as-sets/) 追问类型与集合贴合到什么程度，本篇只管让记号读得下去。

## 集合、元素与子集

集合写成花括号里的一串元素，比如 $A = \{1, 2, 3\}$。元素属于集合记作 $2 \in A$，不属于记作 $4 \notin A$。集合不记顺序，也不记重复次数，所以 $\{1, 2, 2, 3\}$ 与 $\{3, 1, 2\}$ 是同一个集合。

若 $B$ 的元素都在 $A$ 里，说 $B$ 是 $A$ 的子集，记作 $B \subseteq A$。不含元素的集合叫空集，记作 $\emptyset$，它是任何集合的子集。有限集的元素个数记作 $|A|$，读作 $A$ 的基数。

> [!marginnote] 基数怎么读
> 记号 $|A|$ 对有限集就是元素个数。无限集之间也能比大小，那套理论本库用不到，遇到这个记号按元素个数读即可。

Rust 标准库的有序集合可以把这几条记号跑一遍：

```rust
use std::collections::BTreeSet;

fn main() {
    // 集合不记顺序，也不记重复次数
    let a: BTreeSet<i32> = [1, 2, 2, 3].iter().copied().collect();
    let b: BTreeSet<i32> = [3, 1, 2].iter().copied().collect();
    assert_eq!(a, b);
    assert_eq!(a.len(), 3);

    // 属于与包含
    assert!(a.contains(&2));
    assert!(!a.contains(&4));
    let sub: BTreeSet<i32> = [1, 3].iter().copied().collect();
    assert!(sub.is_subset(&a));

    // 空集是任何集合的子集
    let empty: BTreeSet<i32> = BTreeSet::new();
    assert_eq!(empty.len(), 0);
    assert!(empty.is_subset(&a));

    println!("a={:?} len={}", a, a.len());
}
```

运行输出 `a={1, 2, 3} len=3`。带重复项的数组与打乱顺序的数组收成同一个集合，基数是 3。

## 函数：从定义域到陪域

一个函数要三样东西才算说清：一个集合 $A$ 叫定义域(domain)，一个集合 $B$ 叫陪域(codomain)，以及一条把 $A$ 的每个元素指派到 $B$ 的某个元素的规则。整体记作 $f : A \to B$，读作「$f$ 从 $A$ 到 $B$」。单点的指派写成 $f(x)$，也写成 $x \mapsto x^2$ 这样的箭头形式。

指派要满足两条：定义域里每个元素都有取值，这叫全函数(total function)；同一个元素只有一个取值。两条都是记号自带的承诺，编程语言里的函数签名不保证它们，末尾一节列出几种落空的方式。

Rust 的函数签名把两个集合写在两端：参数类型是定义域，返回类型是陪域。下面这条规则取平方后留个位数：

```rust
use std::collections::BTreeSet;

// f: {0,...,9} -> {0,...,9}, f(x) = x*x mod 10
fn f(x: u32) -> u32 {
    (x * x) % 10
}

fn main() {
    let domain: Vec<u32> = (0..10).collect();
    let codomain: BTreeSet<u32> = (0..10).collect();

    // 像：域里每个元素的取值收集起来
    let image: BTreeSet<u32> = domain.iter().map(|&x| f(x)).collect();

    assert_eq!(domain.len(), 10);
    assert_eq!(codomain.len(), 10);
    assert_eq!(image.len(), 6);
    assert_eq!(
        image.iter().copied().collect::<Vec<u32>>(),
        vec![0, 1, 4, 5, 6, 9]
    );

    // 像是陪域的真子集：3 没有原像
    assert!(image.is_subset(&codomain));
    assert!(!codomain.is_subset(&image));
    assert!(!image.contains(&3));

    println!("domain={} codomain={} image={:?}", domain.len(), codomain.len(), image);
}
```

运行输出 `domain=10 codomain=10 image={0, 1, 4, 5, 6, 9}`。定义域与陪域各有 10 个元素，第三个集合只有 6 个元素，它叫像，下一节把它与陪域分开。

## 像不等于陪域

像(image)是把定义域里每个元素的取值收集起来得到的集合：

$$
f(A) = \{\, f(x) \mid x \in A \,\}
$$

它一定是陪域的子集，不一定等于陪域。上一节那次运行给出的像是 $\{0, 1, 4, 5, 6, 9\}$，陪域是 $\{0, 1, \ldots, 9\}$。3 不在像里，因为没有哪个数的平方以 3 结尾，断言 `assert!(!image.contains(&3))` 记的就是这件事。

两者的来路不同：陪域是写下 $f : A \to B$ 时挑的，像是照着规则算出来的。同一条规则配不同的陪域，指派的内容一个字都不变，但下一节的满射会跟着变。把这两个词混着用，判断满射时就会出错。

## 组合：什么时候两条箭头接得上

有 $f : A \to B$ 与 $g : B \to C$，把 $f$ 的输出交给 $g$，得到第三个函数 $g \circ f : A \to C$，逐点定义是

$$
(g \circ f)(x) = g(f(x))
$$

记号从右往左读，写在右边的 $f$ 先作用，[范畴](../categories/category/) 的旁注解释了这个方向。

组合能不能写下来，条件只有一条：$f$ 的陪域等于 $g$ 的定义域。两端对不上就没有 $g \circ f$ 这个东西可谈。下面 `word_count` 的陪域是 `usize`，`is_even` 的定义域也是 `usize`，接得上：

```rust
// f: &str -> usize，g: usize -> bool，两端对得上，g∘f: &str -> bool
fn word_count(s: &str) -> usize {
    s.split_whitespace().count()
}

fn is_even(n: usize) -> bool {
    n % 2 == 0
}

fn id<T>(x: T) -> T {
    x
}

fn main() {
    // g ∘ f 写成嵌套调用，从里往外读
    let g_after_f = |s: &str| is_even(word_count(s));

    assert_eq!(word_count("domain codomain image"), 3);
    assert_eq!(g_after_f("domain codomain image"), false);
    assert_eq!(g_after_f("domain codomain"), true);

    // 恒等函数插在任意一端都不改变结果
    assert_eq!(is_even(id(word_count("a b"))), g_after_f("a b"));
    assert_eq!(id(is_even(word_count("a b"))), g_after_f("a b"));

    println!("g_after_f(\"domain codomain\")={}", g_after_f("domain codomain"));
}
```

运行输出：

```text
g_after_f("domain codomain")=true
```

词数是 2 时组合给出 true，是 3 时给出 false。反过来拼接就接不上，`is_even` 的陪域是 `bool`，`word_count` 的定义域是字符串：

```rust
fn word_count(s: &str) -> usize {
    s.split_whitespace().count()
}

fn is_even(n: usize) -> bool {
    n % 2 == 0
}

fn main() {
    // 反过来拼：is_even 的陪域是 bool，word_count 的定义域是 &str，接不上
    let f_after_g = |n: usize| word_count(is_even(n));
    println!("{}", f_after_g(3));
}
```

编译报错：

```text
error[E0308]: mismatched types
  --> b_compose_bad.rs:11:43
   |
11 |     let f_after_g = |n: usize| word_count(is_even(n));
   |                                ---------- ^^^^^^^^^^ expected `&str`, found `bool`
   |                                |
   |                                arguments to this function are incorrect
   |
note: function defined here
  --> b_compose_bad.rs:1:4
   |
 1 | fn word_count(s: &str) -> usize {
   |    ^^^^^^^^^^ -------

error: aborting due to 1 previous error

For more information about this error, try `rustc --explain E0308`.
```

数学里「两端对不上就没有这条组合」是一句约定，Rust 里它由类型检查执行，报错信息把两端都写了出来。

每个集合 $A$ 上还有一个恒等函数 $\mathbf{id}_A : A \to A$，取值规则是 $\mathbf{id}_A(x) = x$。把它插在组合链的任意一端，结果不变，上面代码的后两个断言核对了这一点。它在符号运算里承担什么见 [恒等态射](../categories/identity-morphism/)；结合律与组合要满足的两条公理见 [范畴](../categories/category/)；把 $g \circ f$ 写成一个可以传递的值见 [Rust 中的函数组合](../categories/composition-in-rust/)。

## 单射、满射、双射

这三个词各自约束指派的形状。设 $f : A \to B$。

*单射(injective)* 指不同的输入给出不同的输出，写成条件是 $f(x) = f(y)$ 蕴含 $x = y$。

*满射(surjective)* 指陪域里每个元素都被取到，也就是像等于陪域。

*双射(bijective)* 指两条同时成立。

> [!marginnote] 旧称
> 单射也叫一对一(one-to-one)，满射也叫映上(onto)，双射也叫一一对应。旧文献里这几个说法更常见，本库统一用单射、满射、双射。

有限集上前两条可以直接数：像的元素个数等于定义域的元素个数，就是单射(没有两个输入撞到一起)；陪域的每个元素都在像里，就是满射。

```rust
use std::collections::BTreeSet;

// 有限集上的暴力判别：域与陪域都显式给出
fn is_injective(domain: &[i32], f: impl Fn(i32) -> i32) -> bool {
    let image: BTreeSet<i32> = domain.iter().map(|&x| f(x)).collect();
    image.len() == domain.len()
}

fn is_surjective(domain: &[i32], codomain: &[i32], f: impl Fn(i32) -> i32) -> bool {
    let image: BTreeSet<i32> = domain.iter().map(|&x| f(x)).collect();
    codomain.iter().all(|y| image.contains(y))
}

fn main() {
    let five: Vec<i32> = (0..5).collect(); // {0,1,2,3,4}
    let ten: Vec<i32> = (0..10).collect(); // {0,...,9}
    let three: Vec<i32> = (0..3).collect(); // {0,1,2}

    // 单射不满射：x -> 2x，从 5 个元素射进 10 个元素
    let double = |x: i32| 2 * x;
    assert!(is_injective(&five, double));
    assert!(!is_surjective(&five, &ten, double));

    // 满射不单射：x -> x mod 3，从 9 个元素射满 3 个元素
    let nine: Vec<i32> = (0..9).collect();
    let modulo3 = |x: i32| x % 3;
    assert!(!is_injective(&nine, modulo3));
    assert!(is_surjective(&nine, &three, modulo3));

    // 双射：x -> (x+1) mod 5，把 {0..4} 打乱后铺满自己
    let rotate = |x: i32| (x + 1) % 5;
    assert!(is_injective(&five, rotate));
    assert!(is_surjective(&five, &five, rotate));

    // 既不单射也不满射：x -> (x mod 3)，域 {0..8}，陪域 {0..9}
    assert!(!is_injective(&nine, modulo3));
    assert!(!is_surjective(&nine, &ten, modulo3));

    // 同一个函数，换掉陪域就换掉了满射性
    assert!(!is_surjective(&five, &ten, double));
    let evens: Vec<i32> = vec![0, 2, 4, 6, 8];
    assert!(is_surjective(&five, &evens, double));

    println!("inj/surj checks pass");
}
```

运行输出 `inj/surj checks pass`，四种组合各有一个实例。末尾两行值得留意：同一条规则 $x \mapsto 2x$、同一个定义域 $\{0, 1, 2, 3, 4\}$，陪域取 $\{0, 1, \ldots, 9\}$ 时不是满射，陪域取 $\{0, 2, 4, 6, 8\}$ 时是。满射依赖陪域的选择，单射不依赖。

双射的用处是它有逆。$f : A \to B$ 是双射，当且仅当存在 $g : B \to A$ 使得

$$
g \circ f = \mathbf{id}_A, \qquad f \circ g = \mathbf{id}_B
$$

```rust
// f 与 g 都在 {0,1,2,3,4} 上
fn f(x: i32) -> i32 {
    (x + 1) % 5
}

fn g(y: i32) -> i32 {
    (y + 4) % 5
}

fn main() {
    // g ∘ f = id 且 f ∘ g = id，逐点核对整个域
    for x in 0..5 {
        assert_eq!(g(f(x)), x);
        assert_eq!(f(g(x)), x);
    }

    // 不单射就没有逆：x mod 3 把 0 和 3 送到同一处
    let modulo3 = |x: i32| x % 3;
    assert_eq!(modulo3(0), modulo3(3));
    // 任何 h 都无法同时满足 h(0)=0 与 h(0)=3

    println!("f and g are mutually inverse on 0..5");
}
```

运行输出 `f and g are mutually inverse on 0..5`。循环逐点核对了整个定义域，这是有限集上验证那两条等式的办法。不单射的函数写不出逆：$x \bmod 3$ 把 0 与 3 送到同一处，逆函数在那一点要同时取两个值。[同构](../universal-constructions/isomorphism/) 会说明双射就是集合范畴里的同构。

真实类型上也有双射。`u8` 上绕回的加一是一个：

```rust
use std::collections::BTreeSet;

fn main() {
    // u8 的全体取值共 256 个
    let domain: Vec<u8> = (0..=255).collect();
    assert_eq!(domain.len(), 256);

    // 绕回的加一：在 u8 上是双射
    let image: BTreeSet<u8> = domain.iter().map(|&x| x.wrapping_add(1)).collect();
    assert_eq!(image.len(), 256); // 单射
    assert!(domain.iter().all(|y| image.contains(y))); // 满射

    // 它的逆就是绕回的减一
    for x in 0..=255u8 {
        assert_eq!(x.wrapping_add(1).wrapping_sub(1), x);
    }

    // 饱和的加一不是单射：254 与 255 都送到 255
    let sat: BTreeSet<u8> = domain.iter().map(|&x| x.saturating_add(1)).collect();
    assert_eq!(sat.len(), 255);
    assert_eq!(254u8.saturating_add(1), 255u8.saturating_add(1));

    println!("wrapping image={} saturating image={}", image.len(), sat.len());
}
```

运行输出 `wrapping image=256 saturating image=255`。绕回的加一把 256 个取值打乱后铺满自己，逆是绕回的减一。饱和的加一把 254 与 255 都送到 255，像少了一个元素，不是单射。

## 集合与函数构成范畴 Set

把对象取成集合、箭头取成集合之间的函数、组合取成 $g \circ f$、每个对象的恒等态射取成 $\mathbf{id}_A$，[范畴](../categories/category/) 的两条公理都成立：三段连续组合逐点展开都是 $h(g(f(x)))$，恒等函数插在两端都不改变取值。这个范畴记作 $\mathbf{Set}$，本库后面说「在 Set 里」时指的就是它[^proper-class]。

$A$ 到 $B$ 的所有函数本身又构成一个集合，记作 $\mathbf{Set}(A, B)$，也记作 $B^A$。后一个记号来自有限情形的计数，题 2 会把这个数数出来。这个集合叫同态集(hom-set)，见 [同态集](../small-categories/hom-set/) 与 [类型代数](../adt/algebra-of-types/)。

本库举例时多数落在 $\mathbf{Set}$ 里，因为类型与函数看着就像集合与指派。这个对应贴合到什么程度、泛型算什么、发散的函数算什么，留给 [类型即集合](../types-and-functions/types-as-sets/)。

## 看着像函数，其实不是

签名写成 $A \to B$ 不等于真的存在这样一个函数。下面几种情况在记号上都过关，在事实上不成立。

第一种，定义域里有元素没有取值。`u8` 上的加一是标准例子：

```rust
// 签名声称它是从 u8 到 u8 的全函数
fn succ(x: u8) -> u8 {
    x + 1
}

fn main() {
    assert_eq!(succ(0), 1);
    assert_eq!(succ(254), 255);
    println!("succ(255) = {}", succ(255));
}
```

用 `rustc -O` 编译，运行输出 `succ(255) = 0`，退出码 0。不加 `-O` 编译，同一份源码在 255 这一点终止：

```text
thread 'main' (92247078) panicked at e_overflow.rs:3:5:
attempt to add with overflow
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace
```

退出码 101，括号里的线程 ID 每次运行不同。签名声称它是从 `u8` 到 `u8` 的全函数，而 255 这一点要么没有取值，要么取值是 0，取哪一个由编译选项决定。决定权在 `-C overflow-checks`，不在优化等级：`rustc -O -C overflow-checks=on` 编出的程序仍在 255 这一点终止，退出码 101；`rustc -C overflow-checks=off` 不加优化也输出 `succ(255) = 0`，退出码 0。不写这个选项时它跟随 `debug-assertions` 的默认值，于是看着像是优化等级在起作用。同一份源码在两种编译方式下对应两个不同的数学对象。

第二种，改陪域或改规则，函数才全定义：

```rust
fn main() {
    // 同一个「加一」，三种收尾方式：前两种保住陪域 u8 但换掉了规则，第三种把陪域换成 Option<u8>
    assert_eq!(255u8.wrapping_add(1), 0); // 陪域 u8：全定义，但送回 0
    assert_eq!(255u8.saturating_add(1), 255); // 陪域 u8：全定义，但原地不动
    assert_eq!(255u8.checked_add(1), None); // 陪域 Option<u8>：全定义，且如实报告
    assert_eq!(254u8.checked_add(1), Some(255));

    // 除法同理：陪域从 i32 换成 Option<i32> 之后才是全函数
    assert_eq!(10i32.checked_div(3), Some(3));
    assert_eq!(10i32.checked_div(0), None);
    assert_eq!(i32::MIN.checked_div(-1), None);

    println!(
        "wrapping={} saturating={} checked={:?}",
        255u8.wrapping_add(1),
        255u8.saturating_add(1),
        255u8.checked_add(1)
    );
}
```

运行输出 `wrapping=0 saturating=255 checked=None`。三种收尾方式给出三个不同的函数。绕回的加一与饱和的加一都是从 `u8` 到 `u8` 的全函数，陪域没有动过，动的是指派规则，它们已经不是加一了；`checked_add` 保住规则，把陪域换成 `Option<u8>`，既全定义又如实报告。除法同理，除数为 0 时返回 `None`，`i32` 的下界除以负一时也返回 `None`。除法的定义域是 `i32` 与 `i32` 的序对，落空的输入有两类：除数为 0 的序对，共 $2^{32}$ 个；以及下界与负一构成的那一个序对。把陪域换成 `Option` 之后组合怎么接回去，见 [Option 与 Kleisli 组合](../kleisli/option-kleisli/)。

第三种，查表建模的函数天生是部分函数(partial function)。这里的 `Option` 与第二种里的 `checked_add` 是同一个手法：把部分函数编码成全函数。陪域取 `Option<V>` 时查表是全函数，取 `V` 时它是部分函数，两句话说的是同一张表，差别在陪域取哪一个。

```rust
use std::collections::HashMap;

fn main() {
    // 用查表建模 f: {0,1,2,3,4} -> {0,...,9}
    let mut table: HashMap<i32, i32> = HashMap::new();
    for x in 0..5 {
        table.insert(x, 2 * x);
    }

    // 表覆盖了整个域，查得到
    assert_eq!(table.get(&3), Some(&6));
    assert_eq!(table.len(), 5);

    // 域外的键查不到：get 的返回类型是 Option，按 V 作陪域读它就不全定义
    assert_eq!(table.get(&5), None);

    // 漏掉一项，签名毫无变化，函数就不再全定义
    let mut holed: HashMap<i32, i32> = HashMap::new();
    for x in 0..5 {
        if x != 2 {
            holed.insert(x, 2 * x);
        }
    }
    assert_eq!(holed.len(), 4);
    assert_eq!(holed.get(&2), None);

    // 要恢复成全函数，要么补上缺项，要么把陪域改成 Option
    let lookup = |x: i32| holed.get(&x).copied().unwrap_or(0);
    assert_eq!(lookup(2), 0); // 补了一个默认值，函数是全的了，但它不再是 2x
    assert_eq!(lookup(3), 6);

    println!("table={} holed={} lookup(2)={}", table.len(), holed.len(), lookup(2));
}
```

运行输出 `table=5 holed=4 lookup(2)=0`。查表的返回类型是 `Option`，这就是它按 `V` 作陪域时不全定义的记号形式。漏掉一项时类型签名一个字都不变，查不到的那一刻才暴露。补一个默认值能让它重新全定义，代价是它不再是原来那条规则：查 2 得到 0，而 $2 \times 2 = 4$。

第四种，同一个输入给出不同的输出：

```rust
use std::cell::Cell;

fn main() {
    // 签名看着像 i32 -> i32，同一个输入却给出不同输出
    let calls = Cell::new(0);
    let counter = |x: i32| {
        calls.set(calls.get() + 1);
        x + calls.get()
    };

    assert_eq!(counter(10), 11);
    assert_eq!(counter(10), 12);
    assert_eq!(counter(10), 13);
    assert_ne!(counter(10), counter(10));

    println!("calls={}", calls.get());
}
```

运行输出 `calls=5`。三次调用同一个输入分别给出 11、12、13，第四行断言两次调用的结果不相等。类型签名看着像从 `i32` 到 `i32`，指派的单值要求已经破了。函数这个词在编程语言里比在集合论里松，[纯函数](../types-and-functions/pure-functions/) 处理这条差异。

还有一种不涉及代码：把陪域说成像。像不等于陪域那一节的例子里，「它是满射」这句话在陪域取 $\{0, 1, \ldots, 9\}$ 时是错的，在陪域取 $\{0, 1, 4, 5, 6, 9\}$ 时是对的。判断满射之前先确认陪域是哪一个。

## 练习

### 题 1

$f(x) = x^2 \bmod 10$，定义域取 $\{0, 1, \ldots, 9\}$，陪域也取 $\{0, 1, \ldots, 9\}$。它是单射吗？是满射吗？改哪一处能让它变成满射？

解：都不是。3 与 7 的平方都以 9 结尾，两个不同输入撞到一起，不是单射；像只有 6 个元素，陪域有 10 个，不是满射。把陪域换成像本身 $\{0, 1, 4, 5, 6, 9\}$，指派规则一个字不改，它就成了满射。

```rust
use std::collections::BTreeSet;

fn f(x: u32) -> u32 {
    (x * x) % 10
}

fn main() {
    let domain: Vec<u32> = (0..10).collect();
    let image: BTreeSet<u32> = domain.iter().map(|&x| f(x)).collect();

    // 不单射：两个不同输入落在同一处
    assert_eq!(f(3), f(7));
    assert_eq!(f(3), 9);
    assert!(image.len() < domain.len());

    // 陪域取 {0,...,9} 时不满射：3 没有原像
    let codomain: BTreeSet<u32> = (0..10).collect();
    assert!(!codomain.iter().all(|y| image.contains(y)));

    // 陪域换成像本身，同一个取值规则就成了满射
    assert!(image.iter().all(|y| image.contains(y)));
    assert_eq!(image.len(), 6);

    println!("|image|={} f(3)=f(7)={}", image.len(), f(3));
}
```

运行输出 `|image|=6 f(3)=f(7)=9`。任何函数换上自己的像作陪域都变成满射，这个操作不改变指派，只改变对陪域的声明。

### 题 2

定义域有 $m$ 个元素、陪域有 $n$ 个元素。从定义域到陪域一共有多少个函数？其中单射有多少个？先算再用枚举核对。

解：函数共 $n^m$ 个。定义域的每个元素各自在 $n$ 个取值里挑一个，$m$ 次挑选互不牵连，所以是 $n$ 自乘 $m$ 次。记号 $B^A$ 就是从这里来的。

单射要求 $m$ 次挑选不重复：第一个元素有 $n$ 种选法，第二个剩 $n-1$ 种，依此类推，共 $n(n-1)\cdots(n-m+1)$ 个；$m > n$ 时一个也没有。满射没有同样整齐的乘积式，要用容斥原理数。

枚举核对，把每个函数写成长度为 $m$ 的取值表：

```rust
use std::collections::BTreeSet;

// 枚举从 {0..m-1} 到 {0..n-1} 的全部函数，每个函数写成长度为 m 的取值表
fn all_functions(m: u32, n: u32) -> Vec<Vec<u32>> {
    let mut out = vec![vec![]];
    for _ in 0..m {
        let mut next = Vec::new();
        for table in &out {
            for y in 0..n {
                let mut t = table.clone();
                t.push(y);
                next.push(t);
            }
        }
        out = next;
    }
    out
}

fn is_injective(table: &[u32]) -> bool {
    table.iter().collect::<BTreeSet<_>>().len() == table.len()
}

fn is_surjective(table: &[u32], n: u32) -> bool {
    (0..n).all(|y| table.contains(&y))
}

fn main() {
    // 函数总数 = n^m
    for m in 0..4u32 {
        for n in 1..4u32 {
            assert_eq!(all_functions(m, n).len(), n.pow(m) as usize);
        }
    }

    // m=2, n=3：9 个函数，6 个单射，0 个满射
    let fs = all_functions(2, 3);
    assert_eq!(fs.len(), 9);
    assert_eq!(fs.iter().filter(|t| is_injective(t)).count(), 6);
    assert_eq!(fs.iter().filter(|t| is_surjective(t, 3)).count(), 0);

    // m=3, n=2：8 个函数，0 个单射，6 个满射
    let gs = all_functions(3, 2);
    assert_eq!(gs.len(), 8);
    assert_eq!(gs.iter().filter(|t| is_injective(t)).count(), 0);
    assert_eq!(gs.iter().filter(|t| is_surjective(t, 2)).count(), 6);

    // m=n=3：27 个函数，单射与满射是同一批，共 6 个
    let hs = all_functions(3, 3);
    assert_eq!(hs.len(), 27);
    let inj: Vec<_> = hs.iter().filter(|t| is_injective(t)).collect();
    let sur: Vec<_> = hs.iter().filter(|t| is_surjective(t, 3)).collect();
    assert_eq!(inj.len(), 6);
    assert_eq!(sur, inj);

    // 从空集出发恰有一个函数；射入空集则一个都没有
    assert_eq!(all_functions(0, 3).len(), 1);
    assert_eq!(all_functions(2, 0).len(), 0);

    println!(
        "|3^2|={} inj={} |2^3|={} surj={} |3^3|={} bij={}",
        fs.len(),
        6,
        gs.len(),
        6,
        hs.len(),
        inj.len()
    );
}
```

运行输出 `|3^2|=9 inj=6 |2^3|=8 surj=6 |3^3|=27 bij=6`。$m = 2$、$n = 3$ 时 9 个函数里有 6 个单射、没有满射；$m = 3$、$n = 2$ 时 8 个函数里有 6 个满射、没有单射。$m = n = 3$ 时那一段还核对了一件事：单射的那批表与满射的那批表逐项相等。有限集之间元素个数相同时，单射与满射互相蕴含，核对一条即可。这个性质对无限集不成立，$x \mapsto x + 1$ 在自然数上是单射不满射。

### 题 3

定义域是空集时有几个函数？陪域是空集时呢？

解：从空集出发到任何集合恰有一个函数。取值表的长度是 0，这样的表只有一张，指派没有任何元素要处理，两条要求自动满足。这个函数叫空函数。

反过来，射入空集时，定义域非空则一个函数也没有：定义域里随便挑一个元素，它需要一个取值，而陪域里没有元素可取。定义域也是空集时仍有一个，就是空集到自身的空函数。上一题末尾的断言核对了前两种情形，把 `all_functions` 的两个参数都取 0 会得到 1。

定义域取空集这一句在 $\mathbf{Set}$ 里有名字：空集是初始对象，从它出发到任何对象恰有一条箭头。与它对偶的一句换了个集合：单元素集是终端对象，从任何对象到它恰有一条箭头。见 [初始对象与终端对象](../universal-constructions/initial-terminal/) 与 [Void、unit 与 Bool](../types-and-functions/void-unit-bool/)。

### 题 4

单射、满射、双射那一节用「像里有几个不同的值」判单射。这个办法在什么样的陪域上会失效？

解：它依赖两件事。一是陪域上的相等是等价关系，也就是自反、对称、传递。二是这个相等与用来区分陪域元素的标准一致。`f64` 上两条都不成立：NaN 与自己比较不等，自反性破了；正零与负零的位模式不同，比较却说它们相等，两个元素被并成一个。

```rust
// 用「像里有几个不同的值」判单射，前提是陪域上的相等是等价关系
fn distinct_count(values: &[f64]) -> usize {
    let mut seen: Vec<f64> = Vec::new();
    for &v in values {
        if !seen.iter().any(|&s| s == v) {
            seen.push(v);
        }
    }
    seen.len()
}

fn main() {
    // 恒等函数作用在三个互不相同的位模式上
    let domain = [0.0_f64, -0.0_f64, f64::NAN];
    let image: Vec<f64> = domain.iter().map(|&x| x).collect();

    // 三个输入的位模式两两不同
    assert_ne!(domain[0].to_bits(), domain[1].to_bits());
    assert_ne!(domain[1].to_bits(), domain[2].to_bits());

    // 但按 == 数出来的不同值个数是 2，不是 3
    assert_eq!(distinct_count(&image), 2);

    // 两处不一致，机制不同
    assert!(0.0_f64 == -0.0_f64); // 位模式不同，比较说相等
    let n = f64::NAN;
    assert!(n != n); // 同一个值，比较说不等

    println!("distinct_count={}", distinct_count(&image));
}
```

运行输出 `distinct_count=2`。被判别的函数是恒等函数，它是单射；判别法在三个输入上只数出 2 个不同值，于是给出「不是单射」。

两处不一致的机制不同。正零与负零位模式不同，比较说它们相等，于是两个不同的输出被数成一个；在不含 NaN 的取值上 `==` 仍是等价关系，只是比位相等粗一档，粗掉的正是判别法要区分的那一层。NaN 与自己比较不等，自反性不成立，于是同一个输出会被反复记成新值。判单射之前要先说清陪域上按什么标准算相等，这一层记号本身不写。

还有一条前提落在定义域一侧。切片记顺序也记重复次数，集合两样都不记，`domain.len()` 数的是表项个数，不是元素个数。传入 `&[1, 1, 2]` 时它给出 3，像里只有 2 个元素，于是 `is_injective(&[1, 1, 2], |x: i32| x)` 给出 false，被判的却是恒等函数。要么先把定义域去重，要么把参数类型换成 `BTreeSet<i32>`。[恒等态射](../categories/identity-morphism/) 从另一头碰到同一件事：判断一个函数是不是恒等，也要先定下相等的标准。

## 相关词条

- [范畴](../categories/category/) — 本篇的记号在那里写成两条公理
- [组合是编程的本质](../categories/what-is-composition/) — 为什么把箭头的拼接单独提出来
- [恒等态射](../categories/identity-morphism/) — 恒等函数在符号运算里的用处
- [Rust 中的函数组合](../categories/composition-in-rust/) — 把 $g \circ f$ 写成一个可以传递的值
- [类型即集合](../types-and-functions/types-as-sets/) — 类型与集合这个对应贴合到什么程度
- [纯函数](../types-and-functions/pure-functions/) — 同一输入给出同一输出这条要求
- [同构](../universal-constructions/isomorphism/) — 集合范畴里的同构就是双射
- [同态集](../small-categories/hom-set/) — 两个对象之间所有箭头构成的集合
- [初始对象与终端对象](../universal-constructions/initial-terminal/) — 空集与单元素集在集合范畴里的位置
- [Void、unit 与 Bool](../types-and-functions/void-unit-bool/) — 空集与单元素集两端的函数计数
- [类型代数](../adt/algebra-of-types/) — 函数个数与指数记号的来历
- [Option 与 Kleisli 组合](../kleisli/option-kleisli/) — 把陪域改成 Option 之后怎么接回去
- [Haskell 记号速读](../notation/haskell-notation/) — 记号地基的第二篇
- [Rust 类型系统速查](../notation/rust-type-system/) — 记号地基的第三篇

[^proper-class]: 严格讲「所有集合」不构成一个集合，$\mathbf{Set}$ 的对象是一个真类。本库不涉及这层区分，需要小心的场合会把范畴限制成小范畴，用到时再说。
