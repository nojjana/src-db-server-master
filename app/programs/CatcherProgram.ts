import { Program, ProgramName } from "./Program";
import { SaftBaseProgram } from "./SaftBaseProgram";
import { LobbyController } from "../LobbyController";
import { Socket } from "socket.io";
import Matter, { Bodies } from "matter-js";
import { SrcSocket } from "../SrcSocket";

export class CatcherProgram extends SaftBaseProgram implements Program {

  // world
  private gravityX: number = 0;
  private gravityY: number = 0.4;

  // ingredients
  private availableIngredientTypes = 4;
  private ingredientRadius = 50;
  private ingredientLeft?: Matter.Body;
  private ingredientCenter?: Matter.Body;
  private ingredientRight?: Matter.Body;

  // nets
  private netCollisionRadius = 5;
  private net1?: Matter.Body;
  private net2?: Matter.Body;

  // fields where ingredients fall: left, center, right
  private xLeftField = 740;
  private xCenterField = 1280;
  private xRightField = 1820;

  // floors of nets: bottom, middle
  private yCatcherFieldBottom1 = this.height * 0.8
  private yCatcherFieldMiddle2 = this.height * 0.6
  
  // moving nets
  // private movePixelSteps = 180;  // möglichst in 10er Schritten, testen ob funktioniert

  constructor(lobbyController: LobbyController) {
    super(lobbyController);
  }

  /* -------------------- CATCHER GAME LOOP --------------------*/

  initGameLoop(fps: number) {
    this.gameLoop = setInterval(() => {
      if (this.engine == null || this.net1 == null || this.net2 == null)
        return;
      this.engine.world.gravity.x = this.gravityX;
      this.engine.world.gravity.y = this.gravityY;
      Matter.Engine.update(this.engine, 1000 / fps);

      this.lobbyController.sendToDisplays('catcherNet1Position', [this.net1.position.x, this.net1.position.y]);
      this.lobbyController.sendToDisplays('catcherNet2Position', [this.net2.position.x, this.net2.position.y]);

      this.lobbyController.sendToDisplays('updateScore', this.score);

      if (this.ingredientLeft != null) {
        this.lobbyController.sendToDisplays('updateIngredientLeft', [this.ingredientLeft.position.x, this.ingredientLeft.position.y, 0]);
      }

      if (this.ingredientRight != null) {
        this.lobbyController.sendToDisplays('updateIngredientRight', [this.ingredientRight.position.x, this.ingredientRight.position.y, 1]);
      }

      if (this.ingredientCenter != null) {
        this.lobbyController.sendToDisplays('updateIngredientCenter', [this.ingredientCenter.position.x, this.ingredientCenter.position.y, 2]);
      }

    }, 1000 / fps);
  }

  /* -------------------- CATCHER GAME METHODS --------------------*/

  initLevelData(): void  {
    this.initCatcherNets();
    this.initIngredients();
  }
  initIngredients(): void {
    if (this.engine == null) return;

    this.ingredientLeft = Matter.Bodies.circle(
      this.xLeftField,
      -50,
      this.ingredientRadius,
      {
        label: 'Ingredient0'
      });
    Matter.World.add(this.engine.world, this.ingredientLeft);

    this.ingredientRight = Matter.Bodies.circle(
      this.xRightField,
      -600,
      this.ingredientRadius,
      {
        label: 'Ingredient1',
      });
    Matter.World.add(this.engine.world, this.ingredientRight);

    this.ingredientCenter = Matter.Bodies.circle(
      this.xCenterField,
      -1000,
      this.ingredientRadius,
      {
        label: 'Ingredient2',
      });
    Matter.World.add(this.engine.world, this.ingredientCenter);
  }

  initCatcherNets(): void {
    if (this.engine == null) return;

    // net1
    this.net1 = Matter.Bodies.circle(
      this.xCenterField,
      this.yCatcherFieldBottom1,
      this.netCollisionRadius,
      {
        label: 'Catcher1',
        isSensor: true,
        isStatic: true
      });
    Matter.World.add(this.engine.world, this.net1);

    // net2
    this.net2 = Matter.Bodies.circle(
      this.xCenterField,
      this.yCatcherFieldMiddle2,
      this.netCollisionRadius,
      {
        label: 'Catcher2',
        isSensor: true,
        isStatic: true
      });
    Matter.World.add(this.engine.world, this.net2);
  }

  initMatterEventCollision() {
    // Matter.Events.on(this.engine, 'collisionActive', (event) => {
    Matter.Events.on(this.engine, 'collisionStart', (event) => {
      const pairs = event.pairs;

      let i = 0, j = pairs.length;
      for (; i != j; ++i) {
        const pair = pairs[i];

        // TODO
        if (pair.bodyA.label.includes('Catcher') && pair.bodyB.label.includes('Ingredient') || pair.bodyB.label.includes('Catcher') && pair.bodyA.label.includes('Ingredient')) {
          // ingredient catched
          let catcherBody = pair.bodyA;
          let ingredientBody = pair.bodyB;
          if (pair.bodyA.label.includes('Ingredient')) {
            catcherBody = pair.bodyB;
            ingredientBody = pair.bodyA;
          }
          let ingredientTypeNr: number = parseInt(ingredientBody.label.charAt(ingredientBody.label.length - 1));
          // TODO
          let catcherNr: number = parseInt(catcherBody.label.charAt(catcherBody.label.length - 1));

          if (this.allIngredientNumbersOnList.includes(ingredientTypeNr)) {
            // good catch
            console.log('catched a good ingredient, +50 points!!');
            this.score += this.scoreInc;
            this.lobbyController.sendToControllers('vibrate', [catcherNr]);
            this.lobbyController.sendToDisplays('checkIngredientOnList', ingredientTypeNr);
            this.lobbyController.sendToDisplays('adjustScoreByCatchedIngredient',
              [this.scoreInc, ingredientTypeNr, ingredientBody.position.x, ingredientBody.position.y]);
          } else if (this.isInedible(ingredientTypeNr)) {
            // beatle iiiih
            console.log('catched something inedible! iiiiiks!');
            this.score -= this.scoreInc*2;
            this.lobbyController.sendToDisplays('adjustScoreByCatchedIngredient',
              [-(this.scoreInc*2), ingredientTypeNr, ingredientBody.position.x, ingredientBody.position.y]);
          } else {
            // bad catch
            console.log('catched a wrong ingredient, NOT on list!!! -50 points.');
            this.score -= this.scoreInc;
            this.lobbyController.sendToDisplays('adjustScoreByCatchedIngredient',
              [-this.scoreInc, ingredientTypeNr, ingredientBody.position.x, ingredientBody.position.y]);
          }
          this.respawnIngredient(ingredientBody);
        }

        if (pair.bodyA.label === 'Floor' && pair.bodyB.label.includes('Ingredient') || pair.bodyB.label === 'Floor' && pair.bodyB.label.includes('Ingredient')) {
          // ingredient touched the floor -> respawn
          if (pair.bodyB.label.includes('Ingredient')) {
            this.respawnIngredient(pair.bodyB);
          } else {
            this.respawnIngredient(pair.bodyA);
          }
        }
      }
    });
  }

  // private setControllerData(controllerData: number[]): void {
  //   let moveToValX = controllerData[0];
  //   let controllerId = controllerData[1];
  //   console.log("controllerData arrived:", moveToValX, controllerId);
    
  //   if (moveToValX != null && controllerId != null) {
  //     // TODO
  //     // check which controller is sending
  //     switch (controllerId) {
  //       case 1:
  //         if (this.catcherNet1 != undefined) {
  //           this.setShakerPos(moveToValX, this.catcherNet1);
  //         }
  //       case 2:
  //         if (this.catcherNet2 != undefined) {
  //           this.setShakerPos(moveToValX, this.catcherNet2);
  //         }
  //       // case 3:
  //       //   if (this.catcherNet3 != undefined) {
  //       //     this.setShakerPos(moveToValX, this.catcherNet3);
  //       //   }
  //     }
  //   }
  // }

  setControllerDataPlayer1(controllerData: number[]): void {
    let moveToValX = controllerData[0];
    let controllerId = controllerData[1];
    console.log("controllerData from Player 1 arrived:", moveToValX, controllerId);
    
    if (moveToValX != null && controllerId != null && this.net1 != undefined) {
      if (controllerId != 1) return;
      this.setNetPos(moveToValX, this.net1);
    }
  }

  setControllerDataPlayer2(controllerData: number[]): void {
    let moveToValX = controllerData[0];
    let controllerId = controllerData[1];
    console.log("controllerData from Player 2 arrived:", moveToValX, controllerId);
    if (moveToValX != null && controllerId != null && this.net2 != undefined) {
      if (controllerId != 2) return;
      this.setNetPos(moveToValX, this.net2);
    }
  }


  private setNetPos(valX: number, netBody: Matter.Body) {
    if (netBody != undefined && netBody != null) {
      switch (valX) {
        case 1:
          // right
          // Matter.Body.applyForce(this.shakerContainer, {x: this.shakerContainer.position.x, y: this.shakerContainer.position.y}, {x: 0.05, y: 0});
          // Matter.Body.translate(this.shakerContainer, {x: this.xRightField, y:  0});
          // this.forceMove(netBody, this.xRightField, netBody.position.y, this.movePixelSteps);
          Matter.Body.setPosition(netBody, {x: this.xRightField, y:  netBody.position.y});
          break;
        case -1:
          // left
          // Matter.Body.applyForce(this.shakerContainer, {x: this.shakerContainer.position.x, y: this.shakerContainer.position.y}, {x: -0.05, y: 0});
          // Matter.Body.translate(this.shakerContainer, {x: this.xLeftField, y:  0});
          // this.forceMove(netBody, this.xLeftField, netBody.position.y, this.movePixelSteps);
          Matter.Body.setPosition(netBody, {x: this.xLeftField, y:  netBody.position.y});
          break;
        case 0:
          // center
          // Matter.Body.translate(this.shakerContainer, {x: this.xCenterField, y:  0});
          // this.forceMove(netBody, this.xCenterField, netBody.position.y, this.movePixelSteps);
          Matter.Body.setPosition(netBody, {x: this.xCenterField, y: netBody.position.y});
          break;
        default:
          break;
      }
    }
  }

  // private fallDown(body: Matter.Body, endY: number, pixelSteps: number): Matter.Vertices {
  //   // moving ingredients down
  //   let newY = body.position.y;
  //   if (body.position.y < endY) {
  //     // fall further down
  //     newY = body.position.y + pixelSteps;
  //   }
  //   // console.log("body.position.y, endY, dy, newY: ", body.position.y, endY, dy, newY);
  //   Matter.Body.setPosition(body, {
  //     x: body.position.x,
  //     y: newY
  //   });

  //   return {x: body.position.x, y: body.position.y};
  // }

  private forceMove(body: Matter.Body, endX: number, endY: number, pixelSteps: number): Matter.Vertices {
    // moving shaker left and right

    // dx is the total distance to move in the X direction
    let dx = endX - body.position.x;

    // dy is the total distance to move in the Y direction
    let dy = endY - body.position.y;

    let newX = body.position.x
    if (dx > 0) {
    // if (dx > pixelSteps) {
      // a little bit to the right
      newX = body.position.x + pixelSteps;
    } else if (dx < 0) {
    // } else if (dx < -pixelSteps) {
      // a little bit to the left
      newX = body.position.x - pixelSteps;
    }

    let newY = body.position.y;
    if (dy > 0) {
      // a little bit down
      newY = body.position.y + pixelSteps;
    } else if (dy < 0) {
      // a little bit up
      newY = body.position.y - pixelSteps;
    }
    Matter.Body.setPosition(body, {
      x: newX,
      y: newY
    });

    return {x: newX, y: newY};
  }

  collectLevelData() {
    let data: any[] = [];

    // 0 -> list
    data.push(this.allIngredientNumbersOnList);
    // 1 2 -> net1
    data.push(this.net1?.position.x);
    data.push(this.net1?.position.y);
    // 3 4 -> net2
    data.push(this.net2?.position.x);
    data.push(this.net2?.position.y);

    return data;
  }

  respawnIngredient(body: Matter.Body) {
    console.log("respawnIngredient: ");
    let newNumber = this.getRandomInt(this.availableIngredientTypes);;
    let newlabel = "Ingredient"+newNumber;

    body.label = newlabel;
    Matter.Body.setPosition(body, {
      x: body.position.x,
      y: -500
    });
    
    switch (body.position.x) {
      case this.xLeftField:
        this.lobbyController.sendToDisplays('changeImageIngredientLeft', [newNumber]);
        break;
      case this.xCenterField:
        this.lobbyController.sendToDisplays('changeImageIngredientCenter', [newNumber]);
        break;
      case this.xRightField:
        this.lobbyController.sendToDisplays('changeImageIngredientRight', [newNumber]);
        break;
      default:
        break;
    }
    console.log("body.label =", body.label);
  }
  
  clearInGameTimers() {

  }

}