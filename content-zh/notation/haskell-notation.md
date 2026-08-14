---
title: "Haskell 记号速读"
tags: ["why-programs-compose"]
---
Haskell 的记号绕不开四类骨架：一行类型签名、一个 `data` 声明、一个 `class` 声明、一个 `instance` 声明；函数定义与 `type`、`newtype` 是它们的变体，本篇一并拆开。每种形状拆成部件，逐段给出读法和 Rust 对照，目标是读懂，不要求会写。本库的 Haskell 片段都不长，出场的地方限于类型类、惰性与高阶类型这三处 Rust 表达不了或者表达变形的场合，其余一律用 Rust；按大纲的顺序，记号章之后接的是 [组合是编程的本质](../categories/what-is-composition/) 与 [范畴](../categories/category/)。同章的 [集合与函数](../notation/sets-and-functions/) 讲函数的集合论说法，[Rust 类型系统速查](../notation/rust-type-system/) 讲 Rust 一侧的记号细节。

本机没有装 GHC，本篇的 Haskell 片段没有运行过。每条签名都对照 GHC base 4.22.0.0 的官方文档逐条核对（核对日期 2026-08-14），自拟的片段只使用文档里出现过的记号形状；正文只描述类型与读法，不写运行结果。Rust 对照代码用 rustc 1.97.1 实际编译运行，输出照抄。

## 一行签名里有什么

一行签名分三段：名字、双冒号、类型。双冒号读作「类型为」，把左边的名字和右边的类型接起来。

```haskell
id  :: a -> a
not :: Bool -> Bool
map :: (a -> b) -> [a] -> [b]
```

第一行读作：`id` 的类型为 `a -> a`。箭头读作「到」，左边是参数类型，右边是结果类型。`id` 的语义在 [恒等态射](../categories/identity-morphism/) 讲过，这里只看记号。

首字母的大小写是有意义的。`Bool` 大写开头，指一个具体的类型；`a` 小写开头，是类型变量，代表任何类型。Rust 用尖括号把类型参数圈出来并显式声明，Haskell 不声明，靠首字母大小写认出来。

> [!marginnote] 小写字母的量化范围
> 签名里的小写字母对任何类型成立，读的时候可以在整行前面默念一句「对任意类型」。这个量词两边都不写出来，Rust 靠尖括号里的声明认它，Haskell 靠首字母认它。

同一条 `id`，Rust 写成这样：

```rust
fn id<T>(x: T) -> T {
    x
}
```

回到 `map` 那一行，它多了两样东西。`[a]` 是列表类型，读作「`a` 的列表」，方括号出现在类型位置就是列表的记号。`(a -> b)` 外面的括号说明这一整段是一个参数，也就是说 `map` 的第一个参数本身是一条函数。

类型也可以起别名：

```haskell
type String = [Char]
```

`type` 声明的等号两边是同一个类型，编译器不区分它们，与 Rust 的 `type` 关键字对应。别名与 `data` 不同：`data` 造出一个新类型，`type` 只是换个名字。

## 箭头往右结合

多参数函数在 Haskell 的签名里看不出括号。原因是箭头往右结合，`a -> b -> c` 是 `a -> (b -> c)` 的省略写法。

```haskell
add :: Int -> Int -> Int
add x y = x + y
```

这一行有两种读法，两种读法给出同一个类型。一种是「吃两个 `Int`，吐一个 `Int`」；另一种是「吃一个 `Int`，吐出一条吃 `Int` 吐 `Int` 的函数」。后一种是 Haskell 里实际发生的事，柯里化说的就是这件事（名字来自逻辑学家 Haskell Curry）。给 `add` 一个参数，剩下的部分就是一条函数：

```haskell
add2 :: Int -> Int
add2 = add 2
```

Rust 没有这个默认行为，两个参数就是两个参数；要得到同样的效果，得手写一个返回闭包的函数：

```rust
fn add(x: i32, y: i32) -> i32 {
    x + y
}

// 柯里化版本：吃一个 i32，吐出一个「吃 i32 吐 i32」的函数
fn add_curried(x: i32) -> impl Fn(i32) -> i32 {
    move |y| x + y
}

// 高阶参数：参数本身是函数，Haskell 签名里这一段必须加括号
fn apply_to_3(f: impl Fn(i32) -> i32) -> i32 {
    f(3)
}

fn main() {
    assert_eq!(add(2, 3), 5);
    assert_eq!(add_curried(2)(3), 5);

    // 部分应用：只给一个参数，留下一条函数
    let add2 = add_curried(2);
    assert_eq!(add2(40), 42);
    assert_eq!(add2(0), 2);

    // 高阶参数
    assert_eq!(apply_to_3(|x| x * 10), 30);
    assert_eq!(apply_to_3(&add2), 5);

    println!(
        "add(2,3)={} add_curried(2)(3)={} add2(40)={} apply_to_3(*10)={}",
        add(2, 3),
        add_curried(2)(3),
        add2(40),
        apply_to_3(|x| x * 10)
    );
}
```

运行输出 `add(2,3)=5 add_curried(2)(3)=5 add2(40)=42 apply_to_3(*10)=30`，六组断言全部通过。`apply_to_3` 对应 Haskell 里的高阶参数写法，它的签名是 `(Int -> Int) -> Int`，第一段的括号不能省：省掉就成了 `Int -> Int -> Int`，含义从「吃一条函数」变成「吃两个整数」。

同一个规则在标准库的签名里反复出现：

```haskell
const :: a -> b -> a
flip  :: (a -> b -> c) -> b -> a -> c
```

`const` 吃两个参数，把第二个丢掉。`flip` 一行里两种写法都在：括号里的 `a -> b -> c` 是一个参数，也就是一条吃两个值的函数；括号外的 `b -> a -> c` 是 `flip` 自己的后两个参数加上结果。

元组给出第三种写法：

```haskell
curry   :: ((a, b) -> c) -> a -> b -> c
uncurry :: (a -> b -> c) -> (a, b) -> c
```

`(a, b)` 是二元组类型。这两行把「一次吃一个元组」与「分两次各吃一个」之间的换算写死在签名里。这个换算的范畴论含义在 [柯里化](../function-types/currying/)，本篇只当作读签名的练习。

组合算子的签名也遵守同一条规则：

```haskell
(.) :: (b -> c) -> (a -> b) -> a -> c
($) :: (a -> b) -> a -> b
```

名字写在圆括号里，表示它是一个中缀算子：写签名时加括号当普通名字用，写表达式时才放到两个参数中间——这是 `(.)` 那一行的第一对括号。第二对圈出第一个参数，第三对圈出第二个参数，末尾的 `a -> c` 不带括号，按右结合并进来，就是组合出来的那条函数。方向是从右往左，与 [范畴](../categories/category/) 里 $g \circ f$ 的读法一致；Rust 一侧的写法见 [Rust 中的函数组合](../categories/composition-in-rust/)。题 2 把这三对括号再拆一遍。

另一个算子读代码时常遇到，它的作用是省括号：

```haskell
f $ g x     -- 与 f (g x) 同义
```

## 函数定义没有括号和逗号

定义一条函数，等号左边写名字和参数，参数之间用空格隔开，不写括号也不写逗号；等号右边是一个表达式，没有 `return`。上一节的 `add x y = x + y` 就是这个形状。

一条函数可以写成多个方程，每个方程左边直接写模式，从上往下匹配：

```haskell
describe :: Bool -> String
describe True  = "yes"
describe False = "no"
```

Rust 把分支放进函数体，用 `match` 表达同一件事：

```rust
fn describe(b: bool) -> &'static str {
    match b {
        true => "yes",
        false => "no",
    }
}

fn main() {
    assert_eq!(describe(true), "yes");
    assert_eq!(describe(false), "no");
    println!("describe(true)={} describe(false)={}", describe(true), describe(false));
}
```

运行输出 `describe(true)=yes describe(false)=no`。两边的差别是分支写在哪里：Haskell 写在函数名的层面，一个名字对应多个方程；Rust 写在函数体里，一个函数体对应一个 `match`。

## data 声明里的和与积

`data` 声明造一个新类型。等号右边用竖线分隔若干支，每一支是一个数据构造器；构造器后面并排写的类型，是这一支携带的字段。

```haskell
data Maybe a
  = Nothing
  | Just a

data Either a b
  = Left a
  | Right b
```

`Maybe a` 有两支：`Nothing` 不带字段，`Just` 带一个 `a`。竖线读作「或」，所以一个 `Maybe a` 的值要么是 `Nothing`，要么是 `Just` 包着一个 `a`。这就是 Rust 的 `Option`：`Nothing` 对应 `None`，`Just` 对应 `Some`。`Either a b` 对应 `Result`，文档写明习惯上 `Left` 放错误值、`Right` 放正确值，与 `Err` 和 `Ok` 的分工一致。

字段多于一个时并排写下去：

```haskell
data Shape
  = Circle Double
  | Rect Double Double

area :: Shape -> Double
area (Circle r) = pi * r * r
area (Rect w h) = w * h
```

`Rect Double Double` 这一支带两个字段，并排写，中间不加逗号。两个字段同时出现是积，两支用竖线并列是和；类型的加法与乘法在 [和类型](../adt/sum-types/)、[积类型](../adt/product-types/) 与 [类型代数](../adt/algebra-of-types/) 展开，本篇只认形状。`area` 的两个方程各匹配一支，模式里的 `(Circle r)` 要加括号，不加会被读成两个并排的参数。`pi` 来自 `Floating` 这个类型类，`Double` 是它的实例。

Rust 一侧是 `enum` 加 `match`：

```rust
// data Shape = Circle Double | Rect Double Double
#[derive(Debug)]
enum Shape {
    Circle(f64),
    Rect(f64, f64),
}

// data Point = Point Double Double
#[derive(Debug, PartialEq)]
struct Point(f64, f64);

// data Named = Named { name :: String, age :: Int }
#[derive(Debug, PartialEq)]
struct Named {
    name: String,
    age: i32,
}

fn area(s: &Shape) -> f64 {
    match s {
        Shape::Circle(r) => std::f64::consts::PI * r * r,
        Shape::Rect(w, h) => w * h,
    }
}

fn main() {
    let c = Shape::Circle(1.0);
    let r = Shape::Rect(3.0, 4.0);

    assert_eq!(area(&r), 12.0);
    assert!((area(&c) - std::f64::consts::PI).abs() < 1e-12);

    let p = Point(1.5, 2.5);
    assert_eq!(p.0, 1.5);
    assert_eq!(p, Point(1.5, 2.5));

    let n = Named {
        name: String::from("ada"),
        age: 36,
    };
    assert_eq!(n.name, "ada");
    assert_eq!(n.age, 36);

    println!("area(rect)={} area(circle)={:.5} point={:?}", area(&r), area(&c), p);
}
```

运行输出 `area(rect)=12 area(circle)=3.14159 point=Point(1.5, 2.5)`。

字段也可以带名字，写在花括号里，名字后面接双冒号和字段类型：

```haskell
newtype Identity a = Identity { runIdentity :: a }
```

这一行用的是 `newtype` 而不是 `data`。`newtype` 限定只有一支、这一支只有一个字段，花括号这套记号与 `data` 共用。花括号里的名字由编译器自动生成一个同名的取值函数，所以 `runIdentity` 既是字段名，也是从 `Identity a` 取回 `a` 的函数；base 的文档把 `runIdentity` 列在这个 newtype 的字段一栏。

Rust 一侧对应两种 struct：并排、不带名字的字段对应元组结构体（上面的 `Point`），花括号里带名字的字段对应具名字段结构体（上面的 `Named`）。

## 约束写在双箭头前面

签名里出现 `=>` 时，它把这一行切成两段：前段是对类型变量的要求，后段才是类型本身。读的时候先跳过前段读后段，再回头看要求。

```haskell
length       :: Foldable t => t a -> Int
lookup       :: Eq a => a -> [(a, b)] -> Maybe b
notElem      :: (Foldable t, Eq a) => a -> t a -> Bool
fromIntegral :: (Integral a, Num b) => a -> b
```

第一行读作：对任何满足 `Foldable` 的 `t`，`length` 的类型是 `t a -> Int`。要求多于一条时用圆括号括起来、逗号分隔，像后两行那样。这里的 `Foldable`、`Eq`、`Integral`、`Num` 都是类型类，下一节讲它们怎么声明。

第四行有一处特别：`b` 只出现在结果位置，参数里没有它。这种签名靠调用处期望的类型来定下 `b`，失效模式一节再说它。

Rust 把同一件事写在类型参数上，或者挪进 `where` 子句：

```rust
// 对照 lookup :: Eq a => a -> [(a, b)] -> Maybe b
fn lookup_first<A: PartialEq, B: Clone>(key: &A, table: &[(A, B)]) -> Option<B> {
    table.iter().find(|(k, _)| k == key).map(|(_, v)| v.clone())
}

fn count_bigger<T>(xs: &[T], bound: &T) -> usize
where
    T: PartialOrd,
{
    xs.iter().filter(|x| *x > bound).count()
}

fn main() {
    let table = [("a", 1), ("b", 2)];
    assert_eq!(lookup_first(&"b", &table), Some(2));
    assert_eq!(lookup_first(&"z", &table), None);
    assert_eq!(count_bigger(&[1, 5, 9], &4), 2);

    println!(
        "lookup(b)={:?} lookup(z)={:?} bigger={}",
        lookup_first(&"b", &table),
        lookup_first(&"z", &table),
        count_bigger(&[1, 5, 9], &4)
    );
}
```

运行输出 `lookup(b)=Some(2) lookup(z)=None bigger=2`。两边的位置不同：Haskell 把要求集中在双箭头前面，Rust 分散在类型参数旁边或者集中在 `where` 里。Rust 一侧的记号细节见 [Rust 类型系统速查](../notation/rust-type-system/)。

## class 与 instance

`class` 声明一个类型类：起个名字，带一个类型变量，然后列出方法的签名。方法签名里的那个变量，就是类头部的那个。

```haskell
class Eq a where
  (==) :: a -> a -> Bool
  (/=) :: a -> a -> Bool
```

读作：一个类型 `a` 属于 `Eq`，意味着它提供这两个方法，各吃两个 `a`、吐一个 `Bool`。这与 Rust 的 trait 是同一个位置的东西，差别在于指代自己的写法：Rust 写 `Self`，Haskell 写类头部的类型变量。

类可以要求另一个类先成立，用的是与函数签名里相同的双箭头：

```haskell
class Eq a => Ord a where
  compare :: a -> a -> Ordering
```

读作：想成为 `Ord`，先得是 `Eq`。Rust 写成 `trait Ord: Eq`，要求接在 trait 名后面。

方法可以带默认实现，直接写在类里：

```haskell
class Describe a where
  describe :: a -> String
  shout    :: a -> String
  shout x = describe x ++ "!"
```

`(++)` 是列表拼接，`String` 就是 `Char` 的列表，所以它也拼字符串。`shout` 有默认实现，实例可以不写它。

`instance` 给一个具体类型填上实现，头部写类名和类型名，方法定义与普通函数一样：

```haskell
instance Describe Bool where
  describe True  = "yes"
  describe False = "no"
```

Rust 一侧是 trait 加 impl：

```rust
trait Describe {
    fn describe(&self) -> String;

    fn shout(&self) -> String {
        self.describe().to_uppercase()
    }
}

impl Describe for i32 {
    fn describe(&self) -> String {
        format!("int {}", self)
    }
}

impl Describe for bool {
    fn describe(&self) -> String {
        format!("bool {}", self)
    }

    // 覆盖默认方法
    fn shout(&self) -> String {
        String::from("BOOL!")
    }
}

// 结果类型里没有别的线索：mempty 与 pi 的对照
trait Zero {
    fn zero() -> Self;
}

impl Zero for i32 {
    fn zero() -> i32 {
        0
    }
}

impl Zero for String {
    fn zero() -> String {
        String::new()
    }
}

fn main() {
    assert_eq!(42.describe(), "int 42");
    assert_eq!(42.shout(), "INT 42");
    assert_eq!(true.describe(), "bool true");
    assert_eq!(true.shout(), "BOOL!");

    // 只靠绑定上的类型标注挑实现，参数位置没有任何提示
    let a: i32 = Zero::zero();
    let b: String = Zero::zero();
    assert_eq!(a, 0);
    assert_eq!(b, "");

    // 也可以用 turbofish 指定
    assert_eq!(<i32 as Zero>::zero(), 0);

    println!("{} / {} / a={} b={:?}", 42.shout(), true.shout(), a, b);
}
```

运行输出：

```text
INT 42 / BOOL! / a=0 b=""
```

`Zero` 那一半留到失效模式一节用。最后看一个实例，它把前面几件事凑在一起：

```haskell
instance Functor Maybe where
  fmap _ Nothing  = Nothing
  fmap f (Just x) = Just (f x)
```

下划线是通配模式，表示这个参数用不上。实例头部写的是 `Maybe`，不是 `Maybe a`，少了那个 `a`，这不是笔误，下一节解释。base 里的定义不在文档所在的模块，本篇没有核对源码，这段写法与文档记录的行为一致。

## 类型构造器也能当参数

`Maybe` 单独出现时不是一个类型。`Maybe Int` 是类型，`Maybe` 是「吃一个类型才成为类型的东西」，叫类型构造器。Haskell 允许把类型构造器本身放进类型变量的位置，Rust 的类型参数不接受这种用法。

```haskell
class Functor (f :: Type -> Type) where
  fmap :: (a -> b) -> f a -> f b
  (<$) :: a -> f b -> f a
```

圆括号里那一段是种类标注，读法与类型签名一样：`f` 这个变量，接受一个类型、给出一个类型。方法签名里的 `f a` 在类型层读作「把 `f` 施加到 `a` 上」，与表达式层的函数调用共用一套写法。文档另外写明一点：多参数的类型构造器只有末位那个参数能被 `fmap` 改动，例如 `Either a b` 里的 `b`。

把这一行直译成 Rust 的 trait，编译器直接拒绝：

```rust
trait Functor<F> {
    fn fmap<A, B>(fa: F<A>, f: impl Fn(A) -> B) -> F<B>;
}
```

```text
error[E0109]: type arguments are not allowed on type parameter `F`
  |
2 |     fn fmap<A, B>(fa: F<A>, f: impl Fn(A) -> B) -> F<B>;
  |                       - ^ type argument not allowed
  |                       |
  |                       not allowed on type parameter `F`
```

同样的错误在返回类型的 `F<B>` 上再报一次，rustc 收尾写 `error: aborting due to 2 previous errors`。`F` 是一个类型参数，Rust 不允许再把类型参数施加到别的类型上，这一层能力叫高阶类型（HKT）。直译成 `F<A>` 这个形状走不通，同时覆盖 `Option` 与 `Vec` 的 `Functor` 却写得出来：用泛型关联类型（GAT）把换过参的容器写成一个关联类型，`fmap` 的结果类型指向它。代价是每个实例都要重复声明一次这个关联类型，而且 trait 仍然按具体容器逐个实现，无法对任意一元类型构造器统一量化。做法见 [Rust 里的高阶类型](../functors/hkt-in-rust/)。

> [!marginnote] 高阶在哪里
> 参数本身是一个「吃类型的东西」，这类抽象叫高阶类型。与高阶函数是同一个道理：参数本身还是函数，区别在于这里的函数作用在类型上，不作用在值上。

函子的语义在 [函子](../functors/functor/)。`Applicative` 与 `Monad` 的类头部是同一个形状，种类标注也一样，读法照搬即可，含义留给 [单子](../monads/monad/)。

## 读错记号的几种方式

第一种是把箭头的结合方向读反。`(a -> b) -> c` 与 `a -> b -> c` 长得只差一对括号，含义相差很远：前者吃一条函数，后者吃两个值。上面 Rust 那段里的 `apply_to_3` 与 `add` 就是这一对，`apply_to_3` 的参数是函数，`add` 的两个参数是整数。读到括号先问一句：这对括号圈住的是一个参数，还是结果的一部分。

第二种是把类型类逐条对应到 Rust 的 trait，对不上的地方与预期不同。两处常被当成 Haskell 独有的能力，Rust 其实也有。一处是按结果类型挑实现：`mempty` 的类型是 `a`，`pi` 的类型也是 `a`，参数位置一个变量都没有，只能靠调用处期望的类型定下实例；上面那段 Rust 代码里的 `Zero` 做的是同一件事，两条绑定各写了类型标注，参数位置没有任何提示，编译器照样选中了对应的实现，运行结果里 `a=0`、`b` 是空串。另一处是默认方法：Haskell 在 `class` 里给方法写默认实现，Rust 在 trait 里做同一件事，实例都可以覆盖它——`bool` 的 `shout` 覆盖了默认实现，`i32` 没覆盖。

真正对不上的有两处。一是最小完整定义。`Eq` 的文档写明，两个方法里定义任意一个即可，另一个由默认实现补上。Rust 的 trait 没有表达「二选一」的记号，一个方法要么带默认实现、要么要求实现，说不出「这两个里给出一个就行」。

二是孤儿实例，方向与直觉相反。GHC 允许为别人的类型实现别人的类，只在开启相应警告时提醒；rustc 直接拒绝：

```text
error[E0117]: only traits defined in the current crate can be implemented for types defined outside of the crate
  |
1 | impl std::fmt::Display for Vec<i32> {
  | ^^^^^^^^^^^^^^^^^^^^^^^^^^^--------
  |                            |
  |                            `Vec` is not defined in the current crate
```

约束更紧的是 Rust[^orphans]。

第三种是以为签名说尽了函数的行为。看这两条：

```haskell
error     :: HasCallStack => [Char] -> a
undefined :: HasCallStack => a
```

`undefined` 的类型是 `a`，可以填进任何要一个值的位置，但它不给出值。不终止的计算落在同一处。这不是这两个名字的特权：每个 Haskell 类型里都住着这样一项，签名里看不见它。Rust 把发散单独写进类型，`panic!` 那一支的类型是 `!`，可以填进任何位置：

```rust
fn get(v: &[i32], i: usize) -> i32 {
    match v.get(i) {
        Some(x) => *x,
        // panic! 这一支的类型是 !，可以强转成 i32
        None => panic!("index {} out of range", i),
    }
}

fn main() {
    let v = vec![10, 20, 30];
    assert_eq!(get(&v, 0), 10);
    assert_eq!(get(&v, 2), 30);

    // 越界那一支确实进入了发散分支
    std::panic::set_hook(Box::new(|_| {}));
    let boom = std::panic::catch_unwind(|| get(&v, 9));
    let _ = std::panic::take_hook();
    assert!(boom.is_err());

    println!("get ok; out-of-range branch panicked as expected");
}
```

运行输出 `get ok; out-of-range branch panicked as expected`。差别在于哪一层记录了这件事：Rust 把它写在分支的类型上，Haskell 把它并进每个类型。这对「类型即集合」这个模型有影响，[类型即集合](../types-and-functions/types-as-sets/) 与 [纯函数](../types-and-functions/pure-functions/) 处理它。

## 练习

### 题 1

读下面这条签名，逐段说出每一部分是什么；再写出把 `t` 固定成切片之后的 Rust 签名。

```haskell
foldr :: (a -> b -> b) -> b -> t a -> b
```

解：三个参数、一个结果。第一段 `(a -> b -> b)` 带括号，是一个参数，本身是一条吃 `a` 和 `b`、吐 `b` 的函数。第二段 `b` 是初值。第三段 `t a` 是被折叠的容器。结果类型是 `b`。

有一处容易误会：这条签名没有约束。原因是它抄自 `Foldable` 的类内方法列表，`t` 的要求已经由类头部管住了。把 `foldr` 当顶层名字用时，文档给出的签名带约束，写作 `Foldable t => (a -> b -> b) -> b -> t a -> b`。两种写法说的是同一件事，区别在于 `t` 的要求写在哪里。

这一题只要求读签名，Rust 一侧取最短的写法，把容器固定成切片。`t` 这一层在 Rust 里可以用 `IntoIterator` 约束表达；上一节的 E0109 挡住的是给容器换参，折叠不换参，容器类型从头到尾是同一个：

```rust
fn foldr<A, B>(step: impl Fn(&A, B) -> B, init: B, xs: &[A]) -> B {
    let mut acc = init;
    for x in xs.iter().rev() {
        acc = step(x, acc);
    }
    acc
}

fn main() {
    let xs = vec![1, 2, 3, 4];

    // foldr (+) 0 [1,2,3,4]
    assert_eq!(foldr(|x: &i32, acc: i32| x + acc, 0, &xs), 10);

    // foldr (:) [] xs 得到 xs 自身
    let copied = foldr(
        |x: &i32, mut acc: Vec<i32>| {
            acc.insert(0, *x);
            acc
        },
        Vec::new(),
        &xs,
    );
    assert_eq!(copied, xs);

    // 从右往左的顺序是可见的：减法不满足结合律
    // foldr (-) 0 [1,2,3,4] = 1 - (2 - (3 - (4 - 0))) = -2
    assert_eq!(foldr(|x: &i32, acc: i32| x - acc, 0, &xs), -2);

    println!(
        "sum={} rebuilt={:?} minus={}",
        foldr(|x: &i32, acc: i32| x + acc, 0, &xs),
        copied,
        foldr(|x: &i32, acc: i32| x - acc, 0, &xs)
    );
}
```

运行输出 `sum=10 rebuilt=[1, 2, 3, 4] minus=-2`。减法那一行让方向显形：`1 - (2 - (3 - (4 - 0)))` 得 `-2`，右折叠从右端开始。

### 题 2

下面这条签名里有三对圆括号，说出每一对的作用；再回答：去掉圈住 `b -> c` 的那一对括号之后，类型变成什么。

```haskell
(.) :: (b -> c) -> (a -> b) -> a -> c
```

解：第一对圈住点号本身，把中缀算子写成一个可以放在签名左边的名字。第二对圈出第一个参数，它是一条从 `b` 到 `c` 的函数。第三对圈出第二个参数，一条从 `a` 到 `b` 的函数。剩下的 `a -> c` 不带括号，按右结合并进整行，就是组合出来的那条函数。

去掉第二对括号，得到 `b -> c -> (a -> b) -> a -> c`。按右结合展开，它读成一条吃三个参数的函数：先吃一个 `b`，再吃一个 `c`，再吃一条从 `a` 到 `b` 的函数，给出一条从 `a` 到 `c` 的函数。原来的第一个参数从「一条函数」变成了「两个值」，与组合无关了。

### 题 3

把下面的声明直译成 Rust 的 `enum`，说明编译器为什么拒绝，再给出可以编译的版本。

```haskell
data Tree a
  = Leaf a
  | Node (Tree a) (Tree a)
```

解：声明里 `(Tree a)` 的括号不能省，`Node Tree a` 会被读成两个字段，一个是 `Tree`、一个是 `a`。直译过去是这样：

```rust
enum Tree<A> {
    Leaf(A),
    Node(Tree<A>, Tree<A>),
}
```

```text
error[E0072]: recursive type `Tree` has infinite size
  |
1 | enum Tree<A> {
  | ^^^^^^^^^^^^
2 |     Leaf(A),
3 |     Node(Tree<A>, Tree<A>),
  |          ------- recursive without indirection
  |
help: insert some indirection (e.g., a `Box`, `Rc`, or `&`) to break the cycle
```

差别来自布局。Haskell 的构造器字段默认经指针间接引用，递归多深都不改变一个节点的大小；Rust 的 `enum` 按值内联，`Node` 直接装两棵 `Tree`，就要求 `Tree` 的大小包含两个自己。加一层 `Box` 之后每个节点固定成两个指针宽：

```rust
#[derive(Debug)]
enum Tree<A> {
    Leaf(A),
    Node(Box<Tree<A>>, Box<Tree<A>>),
}

fn sum(t: &Tree<i32>) -> i32 {
    match t {
        Tree::Leaf(x) => *x,
        Tree::Node(l, r) => sum(l) + sum(r),
    }
}

fn depth<A>(t: &Tree<A>) -> usize {
    match t {
        Tree::Leaf(_) => 1,
        Tree::Node(l, r) => 1 + depth(l).max(depth(r)),
    }
}

fn main() {
    let t = Tree::Node(
        Box::new(Tree::Leaf(1)),
        Box::new(Tree::Node(Box::new(Tree::Leaf(2)), Box::new(Tree::Leaf(3)))),
    );

    assert_eq!(sum(&t), 6);
    assert_eq!(depth(&t), 3);

    // Box 之后每个节点大小固定：两个指针
    assert_eq!(
        std::mem::size_of::<Tree<i32>>(),
        2 * std::mem::size_of::<usize>()
    );

    println!("sum={} depth={} size={}", sum(&t), depth(&t), std::mem::size_of::<Tree<i32>>());
}
```

运行输出 `sum=6 depth=3 size=16`。同一棵树两种语言都写得出来，代价落在不同的地方：Haskell 把间接引用设成默认，Rust 要求写出来。

## 相关词条

- [集合与函数](../notation/sets-and-functions/) — 同章：域、陪域，以及函数的集合论定义
- [Rust 类型系统速查](../notation/rust-type-system/) — 同章：Rust 一侧的泛型、trait 约束与闭包记号
- [范畴](../categories/category/) — 大纲里紧接记号章的一章：对象、箭头与两条公理
- [Rust 中的函数组合](../categories/composition-in-rust/) — 组合算子在 Rust 里的写法与限制
- [函子](../functors/functor/) — fmap 的语义与函子法则
- [Rust 里的高阶类型](../functors/hkt-in-rust/) — 缺少高阶类型时 Rust 的绕法
- [和类型](../adt/sum-types/) — data 声明里那些竖线的代数含义
- [柯里化](../function-types/currying/) — 箭头右结合背后的构造
- [类型即集合](../types-and-functions/types-as-sets/) — 每个类型里那一项不产生值的东西

[^orphans]: GHC 用户手册的 -Worphans 条目说明，孤儿实例只触发警告，编译照常通过。后果是 Haskell 库可以在第三方包里给别人的类型补实例，Rust 要先用 newtype 包一层。
