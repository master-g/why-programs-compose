---
title: "范畴：对象与箭头"
tags: ["why-programs-compose"]
---
范畴是一个出奇简单的结构：一些*对象(object)*，一些连接对象的*箭头(arrow)*，外加两条关于箭头如何拼接的规矩。本篇给出完整定义，在 Rust 里把它落地成十行代码，再看几个「长得像范畴却不是」的例子。[组合是编程的本质](../categories/what-is-composition/) 解释了我们为什么关心它；本篇只管把结构本身立起来。

## 箭头可以拼接

先看你天天在做的事。你有一个函数 `f`，吃进 `A` 类型，吐出 `B` 类型；又有一个函数 `g`，吃进 `B`，吐出 `C`。把 `f` 的输出喂给 `g`，你就免费得到了第三个函数——它吃进 `A`，吐出 `C`。数学记号把它写作 $g \circ f$，读作「$g$ 在 $f$ 之后」。

> [!marginnote] 方向之辩
> 组合 $g \circ f$ 从右往左读，与 Unix 管道的从左往右相反；Haskell 的组合算子同样从右往左。记住「$\circ$ 读作 after」就不会迷路。

范畴论者把这件事抽干净：不谈函数体，不谈类型的内部，只留下「对象」「箭头」和「拼接」三个词。箭头也叫*态射(morphism)*——本库两个词混用，跟随语境挑顺口的那个。

> [!marginfigure] 组合三角形
> ![f 从 A 到 B,g 从 B 到 C，组合 g∘f 从 A 直达 C](/assets/categories/svg/category.1.svg)

## 定义：两条公理

一个范畴由对象和箭头组成。每条箭头有一个起点对象和一个终点对象，记 $f : A \to B$。它必须满足：

第一，**箭头可组合，且组合满足结合律**。凡是首尾相接的两条箭头 $f : A \to B$ 与 $g : B \to C$，必须存在它们的组合 $g \circ f : A \to C$；三条箭头连续拼接时，先拼哪一段都得到同一条箭头：

$$
h \circ (g \circ f) = (h \circ g) \circ f
$$

第二，**每个对象自带一条恒等箭头**。对象 $A$ 上的 $\mathbf{id}_A : A \to A$ 在组合中什么都不做：

$$
f \circ \mathbf{id}_A = f, \qquad \mathbf{id}_B \circ f = f
$$

定义到此为止。没有第三条。你可能会嘀咕：一条什么都不做的箭头有什么用？同样的话古罗马人也问过零[^zero]。中性元素的价值在符号运算里才显现——当你操纵的是「箭头本身」而不是箭头两端的值时，你需要一个随时可以填进去、保证不改变结果的占位者。[恒等态射](../categories/identity-morphism/) 展开这一点。

## 在 Rust 里落地

对象取 Rust 的类型，箭头取函数，组合就是「先调 `f` 再调 `g`」：

```rust
fn compose<A, B, C>(f: impl Fn(A) -> B, g: impl Fn(B) -> C) -> impl Fn(A) -> C {
    move |x| g(f(x))
}

fn id<T>(x: T) -> T {
    x
}
```

两条公理不是摆设，可以逐条验证：

```rust
fn main() {
    let double = |x: i32| x * 2;
    let inc = |x: i32| x + 1;
    let to_string = |x: i32| x.to_string();

    // 结合律: h ∘ (g ∘ f) = (h ∘ g) ∘ f
    let left = compose(compose(double, inc), to_string);
    let right = compose(double, compose(inc, to_string));
    assert_eq!(left(21), "43");
    assert_eq!(right(21), "43");

    // 恒等律: f ∘ id = f = id ∘ f
    let f_after_id = compose(id, double);
    let id_after_f = compose(double, id);
    assert_eq!(f_after_id(21), 42);
    assert_eq!(id_after_f(21), 42);

    println!("category laws hold on samples");
}
```

运行输出 `category laws hold on samples`，两组断言全部通过。严格说，断言只验证了样本点；结合律对函数普遍成立，是因为两边展开后都是 `to_string(inc(double(x)))`——同一个表达式[^extensional]。

类型和函数构成的这个范畴，是本库的主场，[类型即集合](../types-and-functions/types-as-sets/) 会给它起名并追问一些细节(泛型算什么？发散的函数算什么？)。

## 长得像范畴的东西

两条公理看着宽松，筛掉的候选者却不少。检验一个结构是不是范畴，就拿这两条去卡。

把网页当对象、超链接当箭头，互联网是范畴吗？不是。A 链到 B、B 链到 C，不保证存在 A 链到 C 的链接；多数网页也没有链向自己的链接。组合与恒等双双缺席。

把人当对象、好友关系当箭头呢？同样卡在组合上：你朋友的朋友未必是你的朋友。

有向图呢？一张任意的有向图不是范畴，理由同上；但任何有向图都能**补全**成一个范畴——给每个节点补自环，给每对首尾相接的边补上拼接边，再把新边之间的拼接也补齐，直到封闭。这个「不做任何多余假设的补全」叫自由范畴，[自由范畴](../small-categories/free-category/) 单独讲它。

失败案例透露了定义的重心：范畴不是「有点连接关系」的松散网络，组合封闭性才是门槛。箭头一旦存在，它参与的一切拼接都必须在场。

## 练习

改编自 CTFP 第一章挑战。

### 题 1

用 `compose` 和 `id` 写一个测试，验证「恒等律对任意函数成立」在样本上的表现。（上文 `main` 已给出；试着换一个非数值类型，比如 `String`，确认泛型 `id` 不需要任何修改。）

解：`id` 的实现对类型一无所知，`compose` 把它与任何函数组合都得到原函数。换成 `String`：

```rust
let shout = |s: String| s.to_uppercase();
let with_id = compose(id, shout);
assert_eq!(with_id("hey".to_string()), "HEY");
```

### 题 2

一张只有两个节点 $A$、$B$ 和一条边 $f : A \to B$ 的有向图，补全成自由范畴后有几条箭头？

解：三条。补上 $\mathbf{id}_A$ 与 $\mathbf{id}_B$，加上原有的 $f$。所有可能的拼接（$f \circ \mathbf{id}_A$、$\mathbf{id}_B \circ f$）按恒等律都等于 $f$，不产生新箭头。

### 题 3

只有一个节点、一条自环边 $f$ 的有向图呢？

解：无穷条。$f$ 可以与自己拼接：$\mathbf{id}, f, f \circ f, f \circ f \circ f, \ldots$，除非我们额外规定某个 $f^n = \mathbf{id}$，否则每一次拼接都是新箭头。这个例子在 [幺半群](../small-categories/monoid/) 里回归：单对象范畴的箭头集，恰好构成一个幺半群。

## 相关词条

- [组合是编程的本质](../categories/what-is-composition/) — 为什么这两条公理值得单独立一门学科
- [恒等态射](../categories/identity-morphism/) — 那条「什么都不做」的箭头的用处
- [Rust 中的函数组合](../categories/composition-in-rust/) — compose 的类型推断、所有权与局限
- [自由范畴](../small-categories/free-category/) — 从任意有向图补全出范畴
- [幺半群](../small-categories/monoid/) — 单对象范畴

[^zero]: 罗马数字系统没有零，罗马人照样修路铺渠；但缺了零的代数寸步难行，擅长代数的是引入了零的阿拉伯与波斯数学家。CTFP 第一章用这个类比为 $\mathbf{id}$ 辩护。

[^extensional]: 在 Haskell 里函数相等没有内建定义，只能这样逐点论证；这叫外延相等，[纯函数](../types-and-functions/pure-functions/) 会再遇到它。
