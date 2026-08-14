---
title: "恒等态射"
tags: ["why-programs-compose"]
---
每个对象自带一条从自己出发、回到自己的箭头，叫恒等态射，它在组合里什么都不做。本篇说明这条箭头为什么不能省、它在符号运算里承担什么，以及 Rust 里哪些「看着什么都没做」的写法其实不是它。[范畴](../categories/category/) 已经把它列进公理，本篇展开那句「中性元素的价值在符号运算里才显现」。

## 定义与唯一性

对象 $A$ 上的恒等态射记作 $\mathbf{id}_A : A \to A$。它满足：对任何 $f : A \to B$ 与任何 $g : Z \to A$，

$$
f \circ \mathbf{id}_A = f, \qquad \mathbf{id}_A \circ g = g
$$

这条箭头是唯一的。假设 $A$ 上有两条箭头 $i$ 与 $i'$ 都满足上面两条等式，那么

$$
i = i \circ i' = i'
$$

第一个等号用了 $i'$ 的性质（它作用在 $i$ 上不改变 $i$），第二个用了 $i$ 的性质（它作用在 $i'$ 上不改变 $i'$）。两条箭头相等，所以说「$A$ 上的恒等态射」时不必担心指的是哪一条。

> [!marginnote] 唯一性的用处
> 唯一性让 $\mathbf{id}_A$ 成为一个可以写进等式的记号。若同一个对象上有两条互不相等的中性箭头，下面所有把恒等当作已知量的推导都要重写。

## 一个实现服务所有类型

Rust 标准库里就有它：

```rust
pub fn identity<T>(x: T) -> T {
    x
}
```

函数体对类型一无所知，所以一个实现覆盖所有类型。这种「实现与类型无关」的多态叫参数多态，它和范畴论里「每个对象都有恒等态射」是同一句话的两种说法。

```rust
use std::convert::identity;

fn main() {
    // 同一个 identity 用在三种类型上，实现一个字都没变
    assert_eq!(identity(42), 42);
    assert_eq!(identity("hi"), "hi");
    assert_eq!(identity(vec![1, 2]), vec![1, 2]);

    // 放进管线当占位：这一步什么都不做，但位置留着
    let steps: Vec<fn(i32) -> i32> = vec![|x| x + 1, identity, |x| x * 2];
    let out = steps.iter().fold(5, |acc, f| f(acc));
    assert_eq!(out, 12);

    // 去掉中间那一步，结果不变
    let without: Vec<fn(i32) -> i32> = vec![|x| x + 1, |x| x * 2];
    assert_eq!(without.iter().fold(5, |acc, f| f(acc)), 12);

    println!("out={}", out);
}
```

运行输出 `out=12`。

## 它在符号运算里做什么

上面那段代码的后半截演示了用处。当你操纵的东西是函数本身，而不是函数的输入输出时，你需要一个「位置占着但不起作用」的元素。

管线里留一个 `identity`，长度不变、类型不变，只有行为是空的。要是没有它，「这一步不做变换」就得换个说法：给每一步套一层 `Option` 再加分支，或者干脆把这一步删掉。删掉会让管线变短，后面步骤的下标跟着移位，配置里按位置写的东西都要改。留下来则什么都不用动。

这和加法里的 0、乘法里的 1 是同一件事：不是为了算出新结果，是为了让「不做事」也有一个能写进表达式的名字。

## 对象可以扔掉

有了恒等态射，对象本身反而成了多余的。

范畴的定义里对象和箭头各占一半，但每个对象恰好配一条恒等态射，而且这个对应是一一的：由 $\mathbf{id}_A$ 能认出 $A$，由 $A$ 能认出 $\mathbf{id}_A$。于是可以只用箭头定义范畴——把那些「与任何能拼上的箭头组合都不改变对方」的箭头挑出来，称它们为对象。

这不是文字游戏。它说明范畴论里的对象不携带任何自身信息，对象的全部身份就是它的恒等态射在组合表里的位置。[组合是编程的本质](../categories/what-is-composition/) 里说对象像星云，这里给出了理由：能看的只有箭头，连对象本身都可以用箭头代替。

## 看着像恒等，其实不是

数学上的单位元不一定是恒等函数。加零在实数上是单位元，在 `f64` 上不是：

```rust
fn add_zero(x: f64) -> f64 {
    x + 0.0
}

fn main() {
    let x = -0.0_f64;
    let y = add_zero(x);

    // 比较运算说它们相等
    assert_eq!(x, y);

    // 位模式说它们不是同一个值
    assert_ne!(x.to_bits(), y.to_bits());
    assert!(x.is_sign_negative());
    assert!(y.is_sign_positive());

    // NaN 更彻底：恒等函数必须返回原值，而 NaN 连自己都不等于
    let n = f64::NAN;
    assert!(add_zero(n).is_nan());
    assert!(n != n);

    println!("-0.0 bits={:#x}, +0.0 bits={:#x}", x.to_bits(), y.to_bits());
}
```

运行输出 `-0.0 bits=0x8000000000000000, +0.0 bits=0x0`。负零加零得到正零，符号位被抹掉了；用 `==` 比较说它们相等，位模式说它们不是同一个值。恒等函数必须原样返回，加零做不到。NaN 这一行更彻底：它连自己都不等于，「返回原值」这句话在它身上要先说清楚按什么标准算相等。

另一类是 Rust 特有的：恒等在类型上不做事，在资源上做事。

```rust
use std::convert::identity;

fn main() {
    // 按值：实参被移走
    let s = String::from("moved");
    let t = identity(s);
    assert_eq!(t, "moved");
    // println!("{}", s);  // 打开这行编译失败：s 已经移走

    // 按引用：T 取成 &String，原值还在
    let u = String::from("kept");
    let r = identity(&u);
    assert_eq!(r, "kept");
    assert_eq!(u, "kept");

    println!("t={} u={}", t, u);
}
```

运行输出 `t=moved u=kept`。打开那行注释，编译器报告：

```text
error[E0382]: borrow of moved value: `s`
  |     let s = String::from("moved");
  |         - move occurs because `s` has type `String`, which does not implement the `Copy` trait
```

数学里的 $\mathbf{id}_A$ 不消耗 $A$，Rust 里按值调用的 `identity` 会把实参移走。类型签名从 `T` 到 `T` 没有变化，所有权变了。要保住原值，就让 `T` 取成引用类型。这不是 Rust 的毛病，是范畴论模型里没有的一层信息，[类型即集合](../types-and-functions/types-as-sets/) 会讨论这个模型贴合到什么程度。

## 练习

### 题 1

[范畴](../categories/category/) 的题 3 提到单对象范畴的箭头集构成幺半群。在那个对应里，恒等态射变成了什么？

解：幺半群的单位元。组合对应幺半群的二元运算，范畴的结合律给出幺半群的结合律，恒等律给出单位律。

两者的差别在数量上：幺半群的单位元只有一个，而恒等态射是每个对象各配一条。单对象范畴里对象只有一个，两者重合。[幺半群](../small-categories/monoid/) 从另一头讲这件事。

### 题 2

写一个函数，用开关决定某一步做不做。注意两个分支的类型。

解：闭包各有各的类型，`if` 的两个分支必须给出同一个类型，所以不能直接把一个闭包和 `identity` 摆在一起返回。非捕获的闭包可以强转成函数指针，转成同一类型之后就能返回：

```rust
use std::convert::identity;

fn maybe_double(on: bool) -> fn(i32) -> i32 {
    if on {
        |x| x * 2
    } else {
        identity
    }
}

fn main() {
    assert_eq!(maybe_double(true)(21), 42);
    assert_eq!(maybe_double(false)(21), 21);
    println!("ok");
}
```

若闭包需要捕获环境，函数指针就不够用了，要改成 `Box<dyn Fn(i32) -> i32>`。`identity` 在这里的作用是让「什么都不做」和「做点什么」落在同一个类型上，不必为前者单开一条分支。

### 题 3

再找一个看着像恒等、实际不是的运算，用断言说明。

解：浮点数往返转换。

```rust
fn main() {
    let x = 0.1_f64;
    let round_trip = x as f32 as f64;
    assert_ne!(x, round_trip);
    println!("{} vs {}", x, round_trip);
}
```

运行输出 `0.1 vs 0.10000000149011612`。绕一圈回到同一个类型，看着像什么都没做，`f32` 那一站的精度已经丢了。判断一个函数是不是恒等，看的是它对每个输入是否返回原值，不是它的类型签名是否首尾相同。

## 相关词条

- [范畴](../categories/category/) — 恒等律作为两条公理之一
- [组合是编程的本质](../categories/what-is-composition/) — 对象像星云的说法
- [Rust 中的函数组合](../categories/composition-in-rust/) — 把 identity 与别的函数拼起来时的类型问题
- [幺半群](../small-categories/monoid/) — 单对象范畴，恒等态射变成单位元
- [类型即集合](../types-and-functions/types-as-sets/) — 所有权在集合模型里没有对应物
- [同构](../universal-constructions/isomorphism/) — 用恒等态射定义「两个对象一样」
