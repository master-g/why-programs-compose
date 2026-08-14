---
title: "Rust 中的函数组合"
tags: ["why-programs-compose"]
---
把 $g \circ f$ 写成一个可以传递的值，在 Rust 里要面对三件数学模型里没有的事：闭包分三种、类型推断要有下游线索、捕获的环境要交代所有权。本篇把 [范畴](../categories/category/) 里那个十行的 `compose` 拆开，说明它能做什么、在哪里会被编译器拦下、以及标准库为什么不提供它。

## 最小的 compose

```rust
fn compose<A, B, C>(f: impl Fn(A) -> B, g: impl Fn(B) -> C) -> impl Fn(A) -> C {
    move |x| g(f(x))
}
```

三个类型参数对应三个对象，两个 `impl Fn` 参数对应两条箭头，返回值对应组合出来的第三条。`move` 把 `f` 与 `g` 搬进闭包，这样返回的闭包不再借用调用处的变量。

返回类型是 `impl Fn`，不是 `impl FnOnce`，所以组合的结果可以再喂给 `compose`，也可以调用多次：

```rust
fn compose<A, B, C>(f: impl Fn(A) -> B, g: impl Fn(B) -> C) -> impl Fn(A) -> C {
    move |x| g(f(x))
}

fn main() {
    let add1 = |x: i32| x + 1;
    let double = |x: i32| x * 2;
    let show = |x: i32| format!("<{}>", x);

    // compose 的返回值可以再喂给 compose
    let pipeline = compose(compose(add1, double), show);
    assert_eq!(pipeline(20), "<42>");

    // 返回的是 Fn，可以调用多次
    assert_eq!(pipeline(0), "<2>");
    assert_eq!(pipeline(0), "<2>");

    println!("{} {}", pipeline(20), pipeline(0));
}
```

运行输出 `<42> <2>`。嵌套两层就得到三段的组合，结合律在这里表现为「先拼哪两段都一样」——把括号挪到右边，结果不变。

## 组合取三种闭包里最严格的那个

Rust 的闭包分三档：`Fn` 可以反复调用，`FnMut` 调用时要改捕获的东西，`FnOnce` 调用一次就把自己消耗掉。组合一条链时，整条链只能落在最严格的那一档上。

拿一个把捕获值移出去的闭包做实验。它只实现 `FnOnce`，塞进上面的 `compose` 会被直接拦下：

```text
error[E0525]: expected a closure that implements the `Fn` trait, but this closure only implements `FnOnce`
  |                this closure implements `FnOnce`, not `Fn`
```

要组合它，`compose` 的三处约束都得放宽成 `FnOnce`：

```rust
fn compose_once<A, B, C>(f: impl FnOnce(A) -> B, g: impl FnOnce(B) -> C) -> impl FnOnce(A) -> C {
    move |x| g(f(x))
}

fn main() {
    let owned = String::from("hello");
    // 这个闭包把 owned 移出去，所以只能调用一次
    let take = move |_: ()| owned;
    let len = |s: String| s.len();

    let f = compose_once(take, len);
    assert_eq!(f(()), 5);
    // f(());  // 打开这行编译失败：f 只能调用一次

    println!("len=5");
}
```

运行输出 `len=5`。打开注释那行，编译器说得很清楚：

```text
error[E0382]: use of moved value: `f`
note: this value implements `FnOnce`, which causes it to be moved when called
```

这一层在范畴论里没有对应物。$\mathbf{Set}$ 里的函数可以任意多次施加在同一个参数上，Rust 的闭包要先回答「调用会不会把自己用掉」。

> [!marginnote] 三档的包含关系
> 每个 Fn 闭包都满足 FnMut 的要求，每个 FnMut 都满足 FnOnce 的要求，反过来不成立。写库时把约束定在够用的最宽那一档，调用方的选择才不会被无谓收窄。

## 类型推断需要下游线索

`compose` 的类型参数 `A`、`B`、`C` 全靠推断。两个闭包如果都不标注参数类型，编译器要从别处找线索。有调用点的时候能找到：

```rust
let f = compose(|x| x + 1, |y| y * 2);
println!("{}", f(1));   // 这一行确定了 A = i32
```

这段能编译，输出 `4`。把最后那行删掉，同样的代码就不行了：

```text
error[E0284]: type annotations needed
```

没有调用点，`x + 1` 里的 `x` 可以是任何实现了加法的类型，编译器不替你挑。给闭包参数写上类型（`|x: i32|`）或者给绑定写上类型，都能解决。

组合链越长，中间类型越依赖两头的信息。这是把函数当值传递时的常见摩擦，与所有权无关。

## 借用可以穿过组合

有一种预期是：返回借用输入的函数没法组合，因为 `compose` 的 `A` 与 `B` 是两个无关的类型参数，写不出「`B` 借用了 `A`」。实测不是这样：

```rust
fn compose<A, B, C>(f: impl Fn(A) -> B, g: impl Fn(B) -> C) -> impl Fn(A) -> C {
    move |x| g(f(x))
}

fn first_word(s: &str) -> &str {
    s.split_whitespace().next().unwrap_or("")
}

fn trim_dot(s: &str) -> &str {
    s.trim_end_matches('.')
}

fn main() {
    let f = compose(first_word, trim_dot);
    assert_eq!(f("hello. world"), "hello");
    println!("{}", f("hello. world"));
}
```

运行输出 `hello`。两段都返回借用自输入的引用，组合照样成立。原因是单态化时 `A` 与 `B` 各自取到了具体的生命周期，编译器只需检查这一组具体参数能否对上，不需要 `compose` 本身表达生命周期之间的依赖。

代价在别处：这样得到的 `f` 绑定了那一个具体的生命周期，不再是对任意生命周期都成立的多态函数。要保住多态性，得把 `compose` 写成接受高阶生命周期约束的形式，或者干脆不组合、直接嵌套调用。

## 捕获环境要交代所有权

下面这段过不了编译：

```rust
fn make() -> impl Fn(i32) -> i32 {
    let k = 10;
    let add_k = |x: i32| x + k;
    compose(add_k, |y| y * 2)
}
```

```text
error[E0373]: closure may outlive the current function, but it borrows `k`, which is owned by the current function
```

`add_k` 默认按引用捕获 `k`，而返回值要活得比 `make` 长。加一个 `move` 让闭包按值捕获就好了：

```rust
fn compose<A, B, C>(f: impl Fn(A) -> B, g: impl Fn(B) -> C) -> impl Fn(A) -> C {
    move |x| g(f(x))
}

fn make() -> impl Fn(i32) -> i32 {
    let k = 10;
    let add_k = move |x: i32| x + k;
    compose(add_k, |y| y * 2)
}

fn main() {
    assert_eq!(make()(1), 22);
    println!("{}", make()(1));
}
```

运行输出 `22`。这不是 `compose` 引入的问题，任何返回闭包的函数都要回答同一个问题；组合只是让它出现得更频繁，因为组合的产物就是要被传出去的。

## 标准库为什么不提供它

Rust 标准库没有 `compose`。多数时候，方法链承担了同样的工作：

```rust
v.iter().map(add1).map(double).collect()
```

`Iterator` 的适配器本身就是组合——`map` 返回一个新的迭代器类型，把两个 `map` 串起来和把两个函数组合起来，结果一致。题 3 用断言核对这一点。

方法链能覆盖的场景里，它比 `compose` 好读：从左往右读，与执行顺序一致，中间类型由编译器管，不需要给每一段起名字。`compose` 的用处集中在另一头——当你要把「组合好的那个函数」本身当作值存起来、传出去、放进表里的时候。上一节 `make` 返回的就是这样一个值。

## 练习

### 题 1

写一个函数，把任意多个函数串成一个。说明它对参与组合的函数有什么额外要求。

解：容器要求元素同类型，所以所有函数必须首尾类型一致，都是从 `T` 到 `T`：

```rust
fn chain<T>(fs: Vec<Box<dyn Fn(T) -> T>>) -> impl Fn(T) -> T {
    move |x| fs.iter().fold(x, |acc, f| f(acc))
}

fn main() {
    let fs: Vec<Box<dyn Fn(i32) -> i32>> = vec![
        Box::new(|x| x + 1),
        Box::new(|x| x * 2),
        Box::new(|x| x - 3),
    ];
    let f = chain(fs);
    assert_eq!(f(20), 39);
    assert_eq!(f(0), -1);
    println!("f(20)={} f(0)={}", f(20), f(0));
}
```

运行输出 `f(20)=39 f(0)=-1`。

两点代价。一是 `Box<dyn Fn>` 带来动态分发，每次调用要过一次指针；二是类型被压成了 `T` 到 `T`，`compose` 那种「中间类型可以变」的能力没有了。想保留中间类型的变化，就只能靠嵌套 `compose`，让编译器为每一段记住类型。

从范畴论看，`T` 到 `T` 的箭头在组合下封闭、有 `identity` 作单位元——这正好是一个 [幺半群](../small-categories/monoid/)，`chain` 就是把这个幺半群的元素依次相乘。

### 题 2

`compose_once` 组合出来的函数只能调用一次。在不改变 `compose_once` 的前提下，让同一条链能调用多次。

解：问题出在被组合的闭包身上，不在组合上。把「移出捕获值」换成「借用或克隆捕获值」，闭包就升格成了 `Fn`，此时用普通的 `compose` 即可：

```rust
fn compose<A, B, C>(f: impl Fn(A) -> B, g: impl Fn(B) -> C) -> impl Fn(A) -> C {
    move |x| g(f(x))
}

fn main() {
    let owned = String::from("hello");
    // 克隆而不是移出，闭包就实现了 Fn
    let take = move |_: ()| owned.clone();
    let len = |s: String| s.len();

    let f = compose(take, len);
    assert_eq!(f(()), 5);
    assert_eq!(f(()), 5);
    println!("len=5 twice");
}
```

运行输出 `len=5 twice`。代价是每次调用多一次分配。`FnOnce` 不是缺陷，它记录了「这个函数消耗资源」这个事实；要多次调用，就得给出资源从哪里来。

### 题 3

核对「两次 `map` 等于一次组合后的 `map`」。

解：

```rust
fn compose<A, B, C>(f: impl Fn(A) -> B, g: impl Fn(B) -> C) -> impl Fn(A) -> C {
    move |x| g(f(x))
}

fn main() {
    let v = vec![1, 2, 3];
    let add1 = |x: i32| x + 1;
    let double = |x: i32| x * 2;

    let twice: Vec<i32> = v.iter().map(|x| add1(*x)).map(double).collect();
    let once: Vec<i32> = v.iter().map(|x| compose(add1, double)(*x)).collect();

    assert_eq!(twice, once);
    assert_eq!(twice, vec![4, 6, 8]);
    println!("{:?} == {:?}", twice, once);
}
```

运行输出 `[4, 6, 8] == [4, 6, 8]`。

这条等式不是巧合，它是函子第二条法则的一个实例：映射保持组合。[函子](../functors/functor/) 会把它写成一般形式，那时 `Vec` 与 `Option` 上的同一条等式会用同一个理由解释。

## 相关词条

- [范畴](../categories/category/) — compose 与 id 满足的两条公理
- [组合是编程的本质](../categories/what-is-composition/) — 为什么要把组合单独提出来
- [恒等态射](../categories/identity-morphism/) — 组合链里的中性元素
- [幺半群](../small-categories/monoid/) — 从 T 到 T 的箭头在组合下构成的结构
- [函子](../functors/functor/) — 映射保持组合的一般形式
- [Rust 类型系统速查](../notation/rust-type-system/) — 泛型、trait 约束与闭包三档的记号
