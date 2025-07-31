# Mermaid 常用语法说明文档

Mermaid 是一个基于 JavaScript 的图表和图形工具，可以通过文本和代码创建图表。

## 1. 流程图 (Flowchart)

```mermaid
flowchart TD
    Start([开始]) --> Input[/输入用户名和密码/]
    Input --> Validate{验证信息}
    Validate -->|有效| CheckRole{检查用户角色}
    Validate -->|无效| Error[显示错误信息]
    Error --> Input

    CheckRole -->|管理员| AdminPanel[管理员面板]
    CheckRole -->|普通用户| UserPanel[用户面板]
    CheckRole -->|访客| GuestPanel[访客面板]

    AdminPanel --> End([结束])
    UserPanel --> End
    GuestPanel --> End
```

### 节点形状
- `A[矩形]` - 矩形
- `B(圆角矩形)` - 圆角矩形
- `C{菱形}` - 菱形（判断）
- `D((圆形))` - 圆形
- `E>标签]` - 标签形状
- `F[[子程序]]` - 子程序

### 连接线类型
- `-->` - 实线箭头
- `-.->` - 虚线箭头
- `==>` - 粗实线箭头
- `--` - 实线
- `-.` - 虚线
- `==` - 粗实线

## 2. 序列图 (Sequence Diagram)

```mermaid
sequenceDiagram
    participant U as 用户
    participant S as 系统
    participant DB as 数据库

    U->>S: 登录请求

    alt 用户名密码正确
        S->>+DB: 查询用户信息
        DB-->>-S: 返回用户数据
        S-->>U: 登录成功
    else 用户名密码错误
        S-->>U: 登录失败
    end

    opt 记住登录状态
        S->>S: 生成Token
        S-->>U: 返回Token
    end
```

### 消息类型
- `A->>B` - 实线箭头
- `A-->>B` - 虚线箭头
- `A-xB` - 实线叉号
- `A--xB` - 虚线叉号

## 3. 甘特图 (Gantt Chart)

```mermaid
gantt
    title 电商网站开发项目进度
    dateFormat YYYY-MM-DD

    section 设计阶段
    需求分析        :done, analysis, 2024-01-01, 7d
    系统设计        :done, design, after analysis, 10d
    UI设计          :active, ui, after analysis, 12d

    section 开发阶段
    后端开发        :active, backend, after design, 20d
    前端开发        :frontend, after ui, 18d

    section 测试阶段
    系统测试        :crit, test, after backend, 5d
    用户验收        :crit, uat, after test, 3d

    section 上线
    正式发布        :milestone, release, after uat, 0d
```

### 任务状态
- `:done` - 已完成
- `:active` - 进行中
- `:crit` - 关键任务
- `:milestone` - 里程碑
- 无标记 - 未开始

## 4. 类图 (Class Diagram)

```mermaid
classDiagram
    class User {
        -Long id
        -String username
        -String email
        +login(username, password) boolean
        +logout() void
    }

    class Customer {
        -String address
        -String phone
        +placeOrder(items) Order
        +getShoppingCart() ShoppingCart
    }

    class Order {
        -Long id
        -Date orderDate
        -OrderStatus status
        +calculateTotal() BigDecimal
        +addItem(product, quantity) void
    }

    class Product {
        -Long id
        -String name
        -BigDecimal price
        +updateStock(quantity) void
        +isAvailable() boolean
    }

    %% 关系
    User <|-- Customer
    Customer --> Order : places
    Order --> Product : contains
```

### 关系类型
- `<|--` - 继承
- `*--` - 组合
- `o--` - 聚合
- `-->` - 关联
- `..>` - 依赖
- `..|>` - 实现

### 可见性
- `+` - public
- `-` - private
- `#` - protected
- `~` - package/internal

## 5. 状态图 (State Diagram)

```mermaid
stateDiagram-v2
    [*] --> 待支付

    待支付 --> 已支付 : 支付成功
    待支付 --> 已取消 : 超时/用户取消

    已支付 --> 待发货 : 商家确认
    已支付 --> 退款中 : 用户申请退款

    待发货 --> 已发货 : 商家发货
    已发货 --> 运输中 : 物流更新
    运输中 --> 待收货 : 到达目的地

    待收货 --> 已完成 : 用户确认收货
    待收货 --> 退货中 : 用户申请退货

    退款中 --> 已退款 : 退款成功
    退货中 --> 已退货 : 退货成功

    已取消 --> [*]
    已退款 --> [*]
    已退货 --> [*]
    已完成 --> [*]

    note right of 待支付 : 用户下单后的初始状态
    note right of 已完成 : 交易成功完成
```

## 6. 饼图 (Pie Chart)

```mermaid
pie title 2024年电商平台市场份额
    "淘宝天猫" : 45.2
    "京东" : 20.1
    "拼多多" : 15.8
    "抖音电商" : 8.5
    "快手电商" : 4.2
    "其他平台" : 6.2
```

## 7. 实体关系图 (ER Diagram)

```mermaid
erDiagram
    USER ||--o{ ORDER : places
    USER ||--|| USER_PROFILE : has

    PRODUCT ||--o{ ORDER_ITEM : contains
    PRODUCT }|--|| CATEGORY : belongs_to

    ORDER ||--|{ ORDER_ITEM : contains
    ORDER ||--|| PAYMENT : has

    USER {
        bigint id PK
        string username UK
        string email UK
        string password_hash
        datetime created_at
        boolean is_active
    }

    PRODUCT {
        bigint id PK
        string name
        text description
        decimal price
        integer stock_quantity
        bigint category_id FK
        boolean is_active
    }

    ORDER {
        bigint id PK
        bigint user_id FK
        string order_number UK
        enum status
        decimal total_amount
        datetime order_date
    }

    ORDER_ITEM {
        bigint id PK
        bigint order_id FK
        bigint product_id FK
        integer quantity
        decimal unit_price
    }
```

### 关系类型
- `||--||` - 一对一关系
- `||--o{` - 一对多关系
- `}|--||` - 多对一关系
- `}|--|{` - 多对多关系

### 字段类型
- `PK` - 主键 (Primary Key)
- `FK` - 外键 (Foreign Key)
- `UK` - 唯一键 (Unique Key)

## 8. 用户旅程图 (User Journey)

```mermaid
journey
    title 电商平台用户购物体验
    section 发现阶段
      访问首页: 4: 用户
      浏览分类: 3: 用户
      搜索商品: 5: 用户
    section 考虑阶段
      查看商品详情: 5: 用户
      阅读评价: 4: 用户
      比较价格: 2: 用户
      咨询客服: 3: 用户, 客服
    section 购买阶段
      添加购物车: 5: 用户
      填写地址: 3: 用户
      选择支付方式: 4: 用户
      完成支付: 5: 用户, 支付系统
    section 售后阶段
      订单确认: 5: 用户, 系统
      物流跟踪: 3: 用户, 物流
      收到商品: 5: 用户
      撰写评价: 3: 用户
```

### 评分说明
- 1分：非常糟糕的体验
- 2分：糟糕的体验
- 3分：一般的体验
- 4分：良好的体验
- 5分：优秀的体验

## 9. 思维导图 (Mind Map)

```mermaid
mindmap
  root((电商系统))
    前端层
      用户界面
        Web端
        移动端
        小程序
      用户体验
        响应式设计
        交互设计
        性能优化
    业务层
      用户管理
        注册登录
        个人中心
        权限管理
      商品管理
        商品展示
        库存管理
        分类管理
      订单管理
        购物车
        下单流程
        订单跟踪
      支付系统
        支付网关
        支付方式
        退款处理
    数据层
      数据库
        用户数据
        商品数据
        订单数据
      缓存
        Redis
        Memcached
      搜索引擎
        Elasticsearch
        商品搜索
    基础设施
      服务器
        Web服务器
        应用服务器
        数据库服务器
      网络
        CDN
        负载均衡
        API网关
      监控
        性能监控
        日志监控
        报警系统
```

## 10. 时间线图 (Timeline)

```mermaid
timeline
    title 电商平台发展历程

    2020 : 公司成立
         : 获得天使投资
         : 团队组建

    2021 : 产品MVP上线
         : 用户突破1万
         : A轮融资完成

    2022 : 移动端App发布
         : 用户突破10万
         : 开拓海外市场

    2023 : B轮融资
         : 用户突破100万
         : 获得行业大奖

    2024 : 上市准备
         : 全球化布局
         : AI技术集成
```

## 11. 象限图 (Quadrant Chart)

```mermaid
quadrantChart
    title 产品功能优先级分析
    x-axis 实现难度低 --> 实现难度高
    y-axis 用户价值低 --> 用户价值高

    quadrant-1 高价值易实现
    quadrant-2 高价值难实现
    quadrant-3 低价值易实现
    quadrant-4 低价值难实现

    用户登录: [0.2, 0.9]
    商品搜索: [0.3, 0.8]
    购物车: [0.4, 0.85]
    在线支付: [0.7, 0.9]
    推荐算法: [0.8, 0.7]
    数据分析: [0.6, 0.4]
    社交分享: [0.3, 0.3]
    多语言支持: [0.9, 0.5]
```

## 常用配置选项

### 主题设置
```mermaid
%%{init: {'theme':'dark'}}%%
flowchart TD
    A --> B
```

可用主题：`default`, `dark`, `forest`, `neutral`, `base`

### 方向设置
- `TD` / `TB` - 从上到下
- `BT` - 从下到上
- `LR` - 从左到右
- `RL` - 从右到左

## 注意事项

1. 节点ID不能包含特殊字符，建议使用字母和数字
2. 中文文本建议用引号包围
3. 复杂图表建议分段绘制
4. 注意语法的严格性，缩进和符号要准确
5. 可以使用 `%%` 添加注释

## 修复常见问题：
1. 中括号内的括号无法识别问题
解决方案：将中括号[]内的括号()改为尖括号<>，例如：
- 正确案例
C -- 否 --> E[直接执行 bmad.js <非 npx 场景, 可能仅是代理>];
E --> F{Agent与用户互动以细化内容<br/><tasks/advanced-elicitation.md>};
D --> E(pm 代理>); //这是正确的因为它不在中括号内
- 错误案例
C -- 否 --> E[直接执行 bmad.js (非 npx 场景, 可能仅是代理)];
E --> F{Agent与用户互动以细化内容<br/>(tasks/advanced-elicitation.md)};


## 在线工具

- [Mermaid Live Editor](https://mermaid.live/) - 在线编辑器
- [GitHub](https://github.com) - 原生支持 Mermaid
- [GitLab](https://gitlab.com) - 原生支持 Mermaid
